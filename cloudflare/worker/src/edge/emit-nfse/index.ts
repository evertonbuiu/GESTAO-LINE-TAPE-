// Copiado de supabase/functions/emit-nfse/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { serve } from "../../compat/deno.js";
import { createClient } from "../../compat/supabase.js";
import { buildCorsHeaders, isDevEnvironment, isOriginAllowed } from "./cors.ts";


// Goiânia NFS-e — SGISS/ISSNet, padrão ABRASF 2.04 (endpoint centralizado em webservice.ts)
import {
  ABRASF_XSD_NAMESPACE,
  REQUIRED_RPS_SERIES,
  WS_TIMEOUT_MS,
  buildSoapEnvelope,
  diagnoseWebService,
  getEndpoint,
  soapActionFor,
  validateMunicipalityAndSeries,
} from "./webservice.ts";
import { validateProviderFiscalDefaults } from "./fiscal.ts";

const NAMESPACE = ABRASF_XSD_NAMESPACE;

interface NFSeRequest {
  invoice_id?: string;
  action: 'emit' | 'cancel' | 'consult' | 'preflight';
}


interface NFSeInvoice {
  id: string;
  rps_number: string;
  rps_series: string;
  issue_date: string;
  competence_date: string;
  provider_cnpj: string;
  provider_name: string;
  provider_address: string;
  provider_im?: string;
  taker_type: string;
  taker_document: string;
  taker_name: string;
  taker_email: string | null;
  taker_phone: string | null;
  taker_address: string | null;
  taker_city_code: string | null;
  taker_state: string | null;
  taker_cep: string | null;
  service_code: string;
  cnae_code: string | null;
  service_description: string;
  service_value: number;
  deduction_value: number;
  base_calculation: number;
  iss_rate: number;
  iss_value: number;
  iss_retention: boolean;
  nature_operation: number;
  special_regime: number;
  simple_national: boolean;
  net_value: number;
}

interface NFSeConfig {
  municipality_code: string;
  municipality_name: string;
  state: string;
  environment: string;
  rps_series: string;
  provider_im?: string | null;
  provider_cnpj?: string | null;
  default_service_code?: string | null;
  nfse_certificates?: {
    storage_path: string;
  };
}

// ============================================================================
// PFX CERTIFICATE HANDLING - Using node-forge for parsing, Web Crypto for signing
// ============================================================================

// Cache forge import across invocations (reduces CPU/memory churn)
let forgePromise: Promise<unknown> | null = null;
async function getForge() {
  if (!forgePromise) {
    forgePromise = import("node-forge");
  }
  const forgeModule: any = await forgePromise;
  return forgeModule.default || forgeModule;
}

// Helper to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper to convert byte string to Uint8Array
function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

// deno-lint-ignore no-explicit-any
async function loadCertificateFromStorage(
  supabaseClient: any,
  certificatePath: string,
  password: string
): Promise<{ privateKey: CryptoKey; certificateB64: string }> {
  console.log('[NFS-e] Loading certificate from storage');
  
  // Download certificate from Supabase storage
  const { data: certData, error: downloadError } = await supabaseClient.storage
    .from('nfse-certificates')
    .download(certificatePath);
  
  if (downloadError || !certData) {
    throw new Error(`Erro ao baixar certificado: ${downloadError?.message || 'Arquivo não encontrado'}`);
  }
  
  const pfxBuffer = await certData.arrayBuffer();
  
  // Use node-forge ONLY for PFX parsing (doesn't require randomBytes)
  const forge = await getForge();
  
  // Convert ArrayBuffer to forge ByteStringBuffer in CHUNKS to prevent WORKER_LIMIT
  const bytes = new Uint8Array(pfxBuffer);
  const forgeBuffer = forge.util.createBuffer();
  const chunkSize = 8192; // 8KB chunks - safe for stack
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    let chunk = '';
    for (let j = i; j < end; j++) {
      chunk += String.fromCharCode(bytes[j]);
    }
    forgeBuffer.putBytes(chunk);
  }
  
  let pfx;
  try {
    const pfxAsn1 = forge.asn1.fromDer(forgeBuffer);
    pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  } catch (e) {
    // NUNCA logar a senha nem o conteúdo do PFX.
    const raw = (e as Error)?.message ?? '';
    const isPasswordIssue = /MAC could not be verified|Invalid password|PKCS#12 MAC/i.test(raw);
    const err = new Error(
      isPasswordIssue
        ? 'Senha do certificado digital (NFSE_CERT_PASSWORD) inválida para este arquivo .pfx'
        : 'Arquivo PFX inválido ou corrompido'
    ) as Error & { code?: string };
    err.code = isPasswordIssue ? 'CERT_PASSWORD_INVALID' : 'CERT_FILE_INVALID';
    throw err;
  }

  
  // Extract private key
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  
  if (!keyBag || !keyBag.key) {
    throw new Error('Chave privada não encontrada no certificado PFX');
  }
  
  // Extract certificate
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  
  if (!certBag || !certBag.cert) {
    throw new Error('Certificado não encontrado no arquivo PFX');
  }
  
  // Convert private key to PKCS#8 DER format for Web Crypto API
  const rsaPrivateKey = forge.pki.privateKeyToAsn1(keyBag.key);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
  const privateKeyDer = forge.asn1.toDer(privateKeyInfo).getBytes();
  const privateKeyBytes = stringToBytes(privateKeyDer);
  
  // Import the private key into Web Crypto API for RSA-SHA1 signing
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  // Convert certificate to DER and then Base64
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const certificateB64 = btoa(certDer);
  
  console.log('[NFS-e] Certificate loaded successfully');
  return { privateKey, certificateB64 };
}

// ============================================================================
// XML BUILDING
// ============================================================================

function formatDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

function formatCurrency(value: number): string {
  return value.toFixed(2);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .toUpperCase();
}

function buildRpsXml(invoice: NFSeInvoice, config: NFSeConfig): string {
  const providerCnpj = formatDocument(invoice.provider_cnpj);
  const takerDoc = formatDocument(invoice.taker_document || '');
  const isCnpj = takerDoc.length > 11;
  
  // Build Tomador (Taker) section
  let tomadorXml = '';
  if (takerDoc && takerDoc !== '00000000000') {
    tomadorXml = `
      <Tomador>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${isCnpj ? `<Cnpj>${takerDoc}</Cnpj>` : `<Cpf>${takerDoc}</Cpf>`}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${escapeXml(invoice.taker_name || 'CONSUMIDOR FINAL')}</RazaoSocial>
        ${invoice.taker_address ? `
        <Endereco>
          <Endereco>${escapeXml(invoice.taker_address)}</Endereco>
          ${invoice.taker_city_code ? `<CodigoMunicipio>${invoice.taker_city_code.padStart(7, '0')}</CodigoMunicipio>` : ''}
          ${invoice.taker_state ? `<Uf>${invoice.taker_state}</Uf>` : ''}
          ${invoice.taker_cep ? `<Cep>${formatDocument(invoice.taker_cep)}</Cep>` : ''}
        </Endereco>
        ` : ''}
        ${invoice.taker_email ? `<Contato><Email>${invoice.taker_email}</Email></Contato>` : ''}
      </Tomador>
    `;
  } else {
    // Tomador não informado
    tomadorXml = `
      <Tomador>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cpf>00000000000</Cpf>
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>TOMADOR NAO INFORMADO</RazaoSocial>
      </Tomador>
    `;
  }

  // Format discriminacao - replace line breaks with \s\n as per Goiânia spec
  const discriminacao = escapeXml(invoice.service_description)
    .replace(/\n/g, '\\s\\n')
    .replace(/[^ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&$%()/+\-.,;:=* \\SN]/g, '');

  // Build the RPS XML according to Goiânia ABRASF 2.0 adapted schema
  const rpsXml = `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="${NAMESPACE}">
  <Rps>
    <InfDeclaracaoPrestacaoServico Id="rps${invoice.rps_number}">
      <Rps>
        <IdentificacaoRps>
          <Numero>${invoice.rps_number}</Numero>
          <Serie>${(config.rps_series || REQUIRED_RPS_SERIES).trim()}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${new Date(invoice.issue_date).toISOString().split('T')[0]}</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Servico>
        <Valores>
          <ValorServicos>${formatCurrency(invoice.service_value)}</ValorServicos>
          ${invoice.deduction_value > 0 ? `<ValorDeducoes>${formatCurrency(invoice.deduction_value)}</ValorDeducoes>` : ''}
          ${invoice.iss_rate > 0 && invoice.simple_national ? `<Aliquota>${(invoice.iss_rate / 100).toFixed(4)}</Aliquota>` : ''}
        </Valores>
        <CodigoTributacaoMunicipio>${invoice.service_code}</CodigoTributacaoMunicipio>
        <Discriminacao>${discriminacao}</Discriminacao>
        <CodigoMunicipio>${config.municipality_code.padStart(7, '0')}</CodigoMunicipio>
      </Servico>
      <Prestador>
        <CpfCnpj>
          <Cnpj>${providerCnpj}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${formatDocument(invoice.provider_im || config.provider_im || '')}</InscricaoMunicipal>
      </Prestador>
      ${tomadorXml}
    </InfDeclaracaoPrestacaoServico>
  </Rps>
</GerarNfseEnvio>`;

  return rpsXml;
}

// ============================================================================
// XML SIGNING WITH WEB CRYPTO API (Native Deno)
// ============================================================================

async function signXml(
  xml: string,
  privateKey: CryptoKey,
  certificateB64: string
): Promise<string> {
  console.log('[NFS-e] Signing XML document...');
  
  // Find the InfDeclaracaoPrestacaoServico element
  const idMatch = xml.match(/Id="([^"]+)"/);
  const elementId = idMatch ? idMatch[1] : 'rps1';
  
  // Extract the element to sign
  const startTag = '<InfDeclaracaoPrestacaoServico';
  const endTag = '</InfDeclaracaoPrestacaoServico>';
  const startIdx = xml.indexOf(startTag);
  const endIdx = xml.indexOf(endTag) + endTag.length;
  
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Elemento InfDeclaracaoPrestacaoServico não encontrado');
  }
  
  const elementToSign = xml.substring(startIdx, endIdx);
  
  // Canonicalize (simplified - remove whitespace between tags)
  const canonicalXml = elementToSign
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Calculate SHA-1 digest using Web Crypto
  const encoder = new TextEncoder();
  const canonicalBytes = encoder.encode(canonicalXml);
  const digestBuffer = await crypto.subtle.digest('SHA-1', canonicalBytes);
  const digestBase64 = btoa(String.fromCharCode(...new Uint8Array(digestBuffer)));
  
  // Build SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${elementId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;
  
  // Sign the SignedInfo using Web Crypto API
  const signedInfoBytes = encoder.encode(signedInfo);
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    signedInfoBytes
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  
  // Build complete Signature element
  const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureBase64}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificateB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
  
  // Insert signature before closing tag of InfDeclaracaoPrestacaoServico
  const signedXml = xml.replace(
    '</InfDeclaracaoPrestacaoServico>',
    `${signatureXml}</InfDeclaracaoPrestacaoServico>`
  );
  
  console.log('[NFS-e] XML signed successfully');
  return signedXml;
}

// ============================================================================
// SOAP COMMUNICATION (ABRASF 2.04 — ISSNet/SGISS Goiânia)
// ============================================================================

/** Testa apenas a conectividade/WSDL (não transmite nada). */
export async function checkWebServiceConnectivity(
  environment?: string | null,
  timeoutMs = WS_TIMEOUT_MS
): Promise<{ reachable: boolean; url: string | null; status: number | null; detail: string | null; diagnostics: unknown }> {
  const d = await diagnoseWebService(environment, timeoutMs);
  return { reachable: d.reachable, url: d.url, status: d.http_status, detail: d.detail, diagnostics: d };
}

/**
 * Envia o envelope SOAP ao endpoint oficial do ambiente. Só repete quando NÃO houve
 * resposta HTTP (timeout/rede), no máximo uma repetição, sempre com o mesmo RPS.
 * Nunca há fallback para o endpoint antigo da Prefeitura.
 */
async function sendToWebService(soapEnvelope: string, environment?: string | null): Promise<string> {
  const endpoint = getEndpoint(environment);
  let lastDetail = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WS_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"${soapActionFor('GerarNfse')}"`,
          'User-Agent': 'Lovable-Supabase-Edge/emit-nfse',
        },
        body: soapEnvelope,
        signal: controller.signal,
      });

      // Houve resposta HTTP: nunca repetir (evita duplicar nota).
      return await response.text();
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      lastDetail = isAbort ? `timeout ${WS_TIMEOUT_MS}ms` : ((e as Error)?.message ?? 'erro de rede');
      if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const err = new Error(
    `Sem resposta do WebService da Prefeitura (${lastDetail}). A nota pode ou não ter sido registrada: ` +
      `consulte por RPS antes de reenviar para evitar duplicidade.`
  ) as Error & { code?: string; noHttpResponse?: boolean };
  err.code = 'WS_NO_RESPONSE';
  err.noHttpResponse = true;
  throw err;
}



// ============================================================================
// RESPONSE PARSING
// ============================================================================

interface NFSeResponse {
  success: boolean;
  invoiceNumber?: string;
  verificationCode?: string;
  issueDate?: string;
  nfseLink?: string;
  errors?: string[];
}

function parseResponse(responseXml: string, providerIm: string): NFSeResponse {
  // Check for SOAP fault
  if (responseXml.includes('<soap:Fault>') || responseXml.includes('<Fault>')) {
    const faultMatch = responseXml.match(/<faultstring>([^<]+)<\/faultstring>/);
    return {
      success: false,
      errors: [faultMatch ? faultMatch[1] : 'Erro SOAP desconhecido'],
    };
  }
  
  // Check for ListaMensagemRetorno (errors)
  const errorMatches = responseXml.matchAll(/<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/g);
  const errors: string[] = [];
  for (const match of errorMatches) {
    errors.push(`${match[1]}: ${match[2]}`);
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  // Extract NFS-e data
  const numeroMatch = responseXml.match(/<Numero>(\d+)<\/Numero>/);
  const codigoVerificacaoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/);
  const dataEmissaoMatch = responseXml.match(/<DataEmissao>([^<]+)<\/DataEmissao>/);
  
  if (numeroMatch && codigoVerificacaoMatch) {
    const numero = numeroMatch[1];
    const codigoVerificacao = codigoVerificacaoMatch[1];
    const dataEmissao = dataEmissaoMatch ? dataEmissaoMatch[1] : undefined;
    
    // Build view link
    const nfseLink = providerIm && numero && codigoVerificacao
      ? `http://www2.goiania.go.gov.br/sistemas/snfse/asp/snfse00200w0.asp?inscricao=${formatDocument(providerIm)}&nota=${numero}&verificador=${codigoVerificacao}`
      : undefined;
    
    return {
      success: true,
      invoiceNumber: numero,
      verificationCode: codigoVerificacao,
      issueDate: dataEmissao,
      nfseLink,
    };
  }
  
  return {
    success: false,
    errors: ['Resposta inesperada do WebService. Verifique os logs.'],
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get('origin');
  const isDev = isDevEnvironment(Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV'));
  const corsHeaders = buildCorsHeaders(origin, isDev);

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin, isDev)) {
      return new Response('origin not allowed', { status: 403, headers: corsHeaders });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }


  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (roleError || !['admin', 'financeiro'].includes(roleData?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const certPassword = Deno.env.get('NFSE_CERT_PASSWORD');

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? 'emit';
    const invoice_id: string | undefined = body?.invoice_id;

    // Audit helper (never throws)
    const audit = async (auditAction: string, entityId: string | null, data: Record<string, unknown>) => {
      try {
        await supabaseClient.from('audit_logs').insert({
          actor_id: user.id,
          action: auditAction,
          entity_type: 'nfse_invoices',
          entity_id: entityId,
          new_data: data,
        });
      } catch (_) { /* auditoria nunca deve quebrar a emissão */ }
    };

    // Fetch config with certificate (necessário para preflight e emissão)
    const { data: config } = await supabaseClient
      .from('nfse_config')
      .select('*, nfse_certificates(*)')
      .limit(1)
      .maybeSingle();

    const activeCert = config?.nfse_certificates ?? null;
    const certValidUntil = activeCert?.valid_until ? new Date(activeCert.valid_until) : null;
    const certExpired = certValidUntil ? certValidUntil.getTime() < Date.now() : false;

    // Libera notas presas em estados transitórios (falha anterior sem rollback).
    const releaseStuckInvoices = async () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      try {
        const { data } = await supabaseClient
          .from('nfse_invoices')
          .update({
            status: 'error',
            error_code: 'STUCK_ROLLBACK',
            error_message:
              'Transmissão anterior interrompida sem resposta. Consulte por RPS antes de reenviar.',
            updated_at: new Date().toISOString(),
          })
          .in('status', ['processing', 'pending_transmission', 'awaiting_send'])
          .lt('updated_at', cutoff)
          .select('id');
        return data?.length ?? 0;
      } catch (_) {
        return 0;
      }
    };

    if (action === 'preflight') {
      const released = await releaseStuckInvoices();

      const endpoint = getEndpoint(config?.environment);
      const municipalityErrors = validateMunicipalityAndSeries(
        config?.municipality_code,
        config?.rps_series ?? REQUIRED_RPS_SERIES
      );
      const fiscalErrors = validateProviderFiscalDefaults({
        provider_im: config?.provider_im,
        rps_series: config?.rps_series,
        default_service_code: config?.default_service_code,
      });

      const checks: Record<string, unknown> = {
        secret_configured: Boolean(certPassword),
        config_found: Boolean(config),
        config_complete: Boolean(config?.is_configured && config?.municipality_code && config?.default_service_code),
        environment: config?.environment ?? null,
        environment_supported: endpoint.available,
        webservice_url: endpoint.url,
        wsdl_url: endpoint.wsdlUrl,
        municipality_valid: municipalityErrors.length === 0,
        municipality_errors: municipalityErrors,
        provider_im: config?.provider_im ?? null,
        default_service_code: config?.default_service_code ?? null,
        fiscal_defaults_valid: fiscalErrors.length === 0,
        fiscal_defaults_errors: fiscalErrors,
        certificate_linked: Boolean(activeCert?.storage_path),
        certificate_active: Boolean(activeCert?.is_active),
        certificate_expired: certExpired,
        certificate_valid_until: activeCert?.valid_until ?? null,
        certificate_password_valid: null,
        webservice_reachable: null,
        stuck_invoices_released: released,
      };

      let certErrorCode: string | null = null;
      let certErrorMessage: string | null = null;

      // (a) Valida a senha do certificado abrindo o PFX — nada é transmitido.
      if (certPassword && activeCert?.storage_path) {
        try {
          await loadCertificateFromStorage(supabaseClient, activeCert.storage_path, certPassword);
          checks.certificate_password_valid = true;
        } catch (e) {
          const err = e as Error & { code?: string };
          checks.certificate_password_valid = false;
          certErrorCode = err.code ?? 'CERT_LOAD_FAILED';
          certErrorMessage = err.message;
        }
      }

      // (e) Diagnóstico DNS/TLS/HTTP/WSDL via GET ?WSDL — sem transmitir nada.
      const diagnostics = await diagnoseWebService(config?.environment);
      const connectivity = {
        reachable: diagnostics.reachable,
        detail: diagnostics.detail,
      };
      checks.webservice_reachable = diagnostics.reachable;
      checks.webservice_detail = diagnostics.detail;
      checks.webservice_diagnostics = {
        dns: diagnostics.dns,
        tls: diagnostics.tls,
        http: diagnostics.http,
        http_status: diagnostics.http_status,
        wsdl: diagnostics.wsdl,
        operations: diagnostics.wsdl_operations,
      };

      const ready =
        Boolean(certPassword) &&
        checks.config_complete === true &&
        endpoint.available &&
        municipalityErrors.length === 0 &&
        fiscalErrors.length === 0 &&
        Boolean(activeCert?.storage_path) &&
        Boolean(activeCert?.is_active) &&
        !certExpired &&
        checks.certificate_password_valid === true &&
        connectivity.reachable;

      const instructions = ready
        ? null
        : !certPassword
          ? 'Configure o secret NFSE_CERT_PASSWORD nas configurações do projeto (Supabase → Edge Functions → Secrets).'
          : municipalityErrors.length > 0
            ? `${municipalityErrors.join(' ')} Ajuste nas configurações fiscais.`
            : fiscalErrors.length > 0
              ? `${fiscalErrors.join(' ')} Ajuste nas configurações fiscais.`
            : !endpoint.available
              ? (endpoint.note ?? 'Ambiente não suportado pelo SGISS de Goiânia.')
              : checks.config_complete !== true
            ? 'Complete a configuração fiscal (município, código de serviço e alíquota) na aba Configurações.'
            : !activeCert?.storage_path || !activeCert?.is_active
              ? 'Vincule e ative um certificado A1 (.pfx) nas configurações de NFS-e.'
              : certExpired
                ? 'O certificado A1 está expirado. Faça upload de um novo certificado.'
                : certErrorCode === 'CERT_PASSWORD_INVALID'
                  ? 'A senha armazenada em NFSE_CERT_PASSWORD não abre este certificado. Atualize o secret NFSE_CERT_PASSWORD com a senha correta do .pfx (Configurações do projeto → Secrets) e valide novamente.'
                  : certErrorCode === 'CERT_FILE_INVALID'
                    ? 'O arquivo .pfx enviado está inválido ou corrompido. Faça upload novamente.'
                    : !connectivity.reachable
                      ? `Não foi possível alcançar o WebService da Prefeitura (${connectivity.detail ?? 'sem detalhe'}). Tente novamente mais tarde; nenhuma nota foi transmitida.`
                      : 'Verifique a configuração fiscal.';

      await audit('nfse_preflight', null, {
        ready,
        cert_error_code: certErrorCode,
        webservice_reachable: connectivity.reachable,
        stuck_invoices_released: released,
      });

      return new Response(
        JSON.stringify({
          success: true,
          ready,
          checks,
          error_code: certErrorCode,
          error: certErrorMessage,
          instructions,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!certPassword) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'missing_secret' });
      return new Response(
        JSON.stringify({
          error: 'Senha do certificado não configurada',
          instructions: 'Configure o secret NFSE_CERT_PASSWORD nas configurações do projeto.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Configuração de NFS-e não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!activeCert || !activeCert.storage_path) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'missing_certificate' });
      return new Response(
        JSON.stringify({
          error: 'Certificado digital não configurado',
          instructions: 'Faça upload de um certificado A1 (.pfx) nas configurações de NFS-e.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (certExpired) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'certificate_expired' });
      return new Response(
        JSON.stringify({
          error: 'Certificado digital expirado',
          instructions: 'Faça upload de um certificado A1 (.pfx) válido nas configurações de NFS-e.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (4) Valida município (5208707) e série (1) exigidos pelo SGISS antes de transmitir.
    const emitEndpoint = getEndpoint(config.environment);
    const municipalityErrors = validateMunicipalityAndSeries(
      config.municipality_code,
      config.rps_series ?? REQUIRED_RPS_SERIES
    );
    if (municipalityErrors.length > 0) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'invalid_municipality_or_series' });
      return new Response(
        JSON.stringify({
          error: municipalityErrors.join(' '),
          error_code: 'INVALID_MUNICIPALITY_OR_SERIES',
          instructions: 'Ajuste o código do município para 5208707 e a série do RPS para 1 nas configurações fiscais.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (4b) Valida a Inscrição Municipal do prestador e o código de serviço padrão.
    const fiscalDefaultErrors = validateProviderFiscalDefaults({
      provider_im: config.provider_im,
      rps_series: config.rps_series,
      default_service_code: config.default_service_code,
    });
    if (fiscalDefaultErrors.length > 0) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'invalid_provider_fiscal_defaults' });
      return new Response(
        JSON.stringify({
          error: fiscalDefaultErrors.join(' '),
          error_code: 'INVALID_PROVIDER_FISCAL_DEFAULTS',
          instructions:
            'Ajuste a Inscrição Municipal (5412455), a série do RPS (1) e o código de serviço padrão (12.12) nas configurações fiscais.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emitEndpoint.available) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'environment_unsupported' });
      return new Response(
        JSON.stringify({
          error: 'Ambiente não suportado pelo SGISS de Goiânia.',
          error_code: 'ENVIRONMENT_UNSUPPORTED',
          instructions: emitEndpoint.note,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (7) Bloqueia emissão quando o WebService/WSDL oficial não está acessível.
    const emitDiagnostics = await diagnoseWebService(config.environment);
    if (!emitDiagnostics.reachable) {
      await audit('nfse_emit_blocked', invoice_id, { reason: 'ws_unreachable', detail: emitDiagnostics.detail });
      return new Response(
        JSON.stringify({
          error: `WebService da Prefeitura indisponível (${emitDiagnostics.detail ?? 'sem detalhe'}). Nenhuma nota foi transmitida.`,
          error_code: 'WS_UNREACHABLE',
          instructions: 'Use "Validar certificado e conexão" e tente novamente mais tarde.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NFS-e] Processing ${action} for invoice: ${invoice_id}`);

    // Libera notas presas de tentativas anteriores antes de reservar esta.
    await releaseStuckInvoices();



    // ---- Transição ATÔMICA: só assume a nota se ela estiver em rps_generated/error.
    // Isso impede emissão duplicada/concorrente e nunca retransmite authorized/processing.
    const { data: claimed, error: claimError } = await supabaseClient
      .from('nfse_invoices')
      .update({
        status: 'processing',
        transmitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
      .in('status', ['rps_generated', 'error'])
      .select('*')
      .maybeSingle();

    if (claimError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao reservar a nota para transmissão' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!claimed) {
      const { data: current } = await supabaseClient
        .from('nfse_invoices')
        .select('id, status')
        .eq('id', invoice_id)
        .maybeSingle();

      if (!current) {
        return new Response(
          JSON.stringify({ error: 'Nota fiscal não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await audit('nfse_emit_blocked', invoice_id, { reason: 'invalid_status', status: current.status });
      return new Response(
        JSON.stringify({
          error: `Esta nota está com status "${current.status}" e não pode ser transmitida novamente.`,
          status: current.status,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoice = claimed;
    await audit('nfse_emit_attempt', invoice_id, {
      rps_number: invoice.rps_number,
      environment: config.environment,
    });

    // Garante que a nota nunca fique presa em "processing".
    let settled = false;
    const settle = async (patch: Record<string, unknown>) => {
      settled = true;
      await supabaseClient
        .from('nfse_invoices')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', invoice_id);
    };

    try {
      // Load certificate
      const { privateKey, certificateB64 } = await loadCertificateFromStorage(
        supabaseClient,
        activeCert.storage_path,
        certPassword
      );

      // Build RPS XML
      const rpsXml = buildRpsXml(invoice as NFSeInvoice, config as NFSeConfig);

      // Sign XML
      const signedXml = await signXml(rpsXml, privateKey, certificateB64);

      // Build SOAP envelope (ABRASF 2.04 — nfseCabecMsg + nfseDadosMsg)
      const soapEnvelope = buildSoapEnvelope('GerarNfse', signedXml);

      // Send to WebService
      const responseXml = await sendToWebService(soapEnvelope, config.environment);

      // Parse response
      const result = parseResponse(responseXml, invoice.provider_im || '');

      if (result.success) {
        // Guarda o XML de retorno apenas na coluna protegida por RLS (nunca em log)
        await settle({
          status: 'authorized',
          invoice_number: result.invoiceNumber,
          protocol_number: result.verificationCode,
          verification_code: result.verificationCode,
          nfse_link: result.nfseLink,
          xml_nfse: responseXml,
          error_message: null,
          error_code: null,
          authorized_at: new Date().toISOString(),
        });

        await audit('nfse_emit_success', invoice_id, {
          invoice_number: result.invoiceNumber,
          environment: config.environment,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'NFS-e emitida com sucesso!',
            invoiceNumber: result.invoiceNumber,
            verificationCode: result.verificationCode,
            nfseLink: result.nfseLink,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorMessage = result.errors?.join('; ') || 'Erro desconhecido';
      await settle({ status: 'error', error_code: 'WS_REJECTED', error_message: errorMessage });
      await audit('nfse_emit_error', invoice_id, { error: errorMessage });

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errors: result.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emitError: unknown) {
      const err = emitError as Error & { code?: string; noHttpResponse?: boolean };
      const message = err?.message ?? 'Erro desconhecido';
      const code = err?.code ?? 'EMIT_FAILED';
      const reconciliationRequired = err?.noHttpResponse === true;

      await settle({
        status: 'error',
        error_code: reconciliationRequired ? 'RECONCILIATION_REQUIRED' : code,
        error_message: message,
      });
      await audit('nfse_emit_error', invoice_id, { error_code: code, reconciliation_required: reconciliationRequired });

      const instructions =
        code === 'CERT_PASSWORD_INVALID'
          ? 'Atualize o secret NFSE_CERT_PASSWORD com a senha correta do certificado .pfx e use "Validar certificado e conexão" antes de tentar de novo.'
          : code === 'CERT_FILE_INVALID'
            ? 'Faça upload novamente do certificado A1 (.pfx) nas configurações de NFS-e.'
            : reconciliationRequired
              ? 'Não houve resposta da Prefeitura. Consulte a nota pelo número do RPS antes de reenviar para evitar duplicidade.'
              : null;

      return new Response(
        JSON.stringify({
          success: false,
          error: message,
          error_code: code,
          reconciliation_required: reconciliationRequired,
          instructions,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      if (!settled) {
        // Rollback de segurança (ex.: exceção inesperada ao gravar o resultado)
        try {
          await supabaseClient
            .from('nfse_invoices')
            .update({
              status: 'error',
              error_code: 'RECONCILIATION_REQUIRED',
              error_message: 'Transmissão encerrada sem confirmação. Consulte por RPS antes de reenviar.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice_id)
            .eq('status', 'processing');
        } catch (_) { /* ignore */ }
      }
    }



  } catch (error: unknown) {
    console.error('[NFS-e] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
