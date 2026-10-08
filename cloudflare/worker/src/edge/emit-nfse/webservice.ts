// Copiado de supabase/functions/emit-nfse/webservice.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// Configuração centralizada do WebService NFS-e de Goiânia/GO — SGISS (ISSNet),
// padrão ABRASF 2.04, vigente desde 01/10/2025 (FAQ SGISS 2026, pergunta 4).
//
// Endpoint oficial de produção:
//   https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx
// O endpoint antigo (nfse.goiania.go.gov.br/ws/nfse.asmx) foi desativado e
// NUNCA deve ser usado como fallback.

export const ABRASF_VERSION = '2.04';
/** Namespace do binding SOAP do ISSNet (WSDL targetNamespace). */
export const WS_NAMESPACE = 'http://nfse.abrasf.org.br';
/** Namespace dos schemas de dados ABRASF. */
export const ABRASF_XSD_NAMESPACE = 'http://www.abrasf.org.br/nfse.xsd';

/** Código IBGE do município de Goiânia/GO. */
export const GOIANIA_MUNICIPALITY_CODE = '5208707';
/** Série de RPS exigida pelo SGISS. */
export const REQUIRED_RPS_SERIES = '1';

/** Endpoint desativado — mantido apenas para detecção/bloqueio. */
export const LEGACY_ENDPOINTS = [
  'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
  'http://nfse.goiania.go.gov.br/ws/nfse.asmx',
];

export type NFSeEnvironment = 'producao' | 'homologacao';

export interface WebServiceEndpoint {
  url: string;
  wsdlUrl: string;
  available: boolean;
  note?: string;
}

const PRODUCTION_URL = 'https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx';

const ENDPOINTS: Record<NFSeEnvironment, WebServiceEndpoint> = {
  producao: {
    url: PRODUCTION_URL,
    wsdlUrl: `${PRODUCTION_URL}?WSDL`,
    available: true,
  },
  homologacao: {
    // A Prefeitura de Goiânia não publica ambiente de homologação no SGISS.
    url: PRODUCTION_URL,
    wsdlUrl: `${PRODUCTION_URL}?WSDL`,
    available: false,
    note:
      'A Prefeitura de Goiânia (SGISS) não disponibiliza ambiente de homologação. ' +
      'Emissão só é permitida com o ambiente configurado como "producao".',
  },
};

export function normalizeEnvironment(env?: string | null): NFSeEnvironment | null {
  const v = (env ?? '').toLowerCase().trim();
  if (v === 'producao' || v === 'produção' || v === 'production' || v === '1') return 'producao';
  if (v === 'homologacao' || v === 'homologação' || v === 'homologation' || v === '2') return 'homologacao';
  return null;
}

export function getEndpoint(env?: string | null): WebServiceEndpoint {
  const normalized = normalizeEnvironment(env);
  return ENDPOINTS[normalized ?? 'producao'];
}

export function isLegacyEndpoint(url: string): boolean {
  return LEGACY_ENDPOINTS.some((legacy) => url.startsWith(legacy.replace(/^https?:\/\//, 'https://')) ||
    url.startsWith(legacy));
}

/** Operações confirmadas no WSDL oficial do ISSNet/Goiânia. */
export const WS_OPERATIONS = [
  'RecepcionarLoteRps',
  'RecepcionarLoteRpsSincrono',
  'GerarNfse',
  'ConsultarLoteRps',
  'ConsultarNfsePorRps',
  'ConsultarNfsePorFaixa',
  'ConsultarNfseServicoPrestado',
  'ConsultarNfseServicoTomado',
  'CancelarNfse',
  'SubstituirNfse',
  'ConsultarUrlNfse',
  'ConsultarRpsDisponivel',
  'ConsultarDadosCadastrais',
] as const;

export type WsOperation = (typeof WS_OPERATIONS)[number];

export function soapActionFor(operation: WsOperation): string {
  return `${WS_NAMESPACE}/${operation}`;
}

/** Cabeçalho ABRASF 2.04 enviado em nfseCabecMsg. */
export function buildCabecalho(): string {
  return `<cabecalho xmlns="${ABRASF_XSD_NAMESPACE}" versao="${ABRASF_VERSION}"><versaoDados>${ABRASF_VERSION}</versaoDados></cabecalho>`;
}

/**
 * Envelope SOAP 1.1 no contrato do ISSNet: elemento da operação no namespace
 * http://nfse.abrasf.org.br contendo nfseCabecMsg e nfseDadosMsg (XML como string).
 */
export function buildSoapEnvelope(operation: WsOperation, dadosXml: string): string {
  const dados = dadosXml.replace(/<\?xml[^?]*\?>/g, '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${WS_NAMESPACE}">
  <soapenv:Body>
    <ws:${operation}>
      <nfseCabecMsg><![CDATA[${buildCabecalho()}]]></nfseCabecMsg>
      <nfseDadosMsg><![CDATA[${dados}]]></nfseDadosMsg>
    </ws:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ---------------------------------------------------------------------------
// Diagnóstico (sem transmitir nada)
// ---------------------------------------------------------------------------

export const WS_TIMEOUT_MS = 30000;

export interface DiagnosticsResult {
  reachable: boolean;
  url: string;
  dns: boolean | null;
  tls: boolean | null;
  http: boolean | null;
  http_status: number | null;
  wsdl: boolean | null;
  wsdl_operations: string[];
  detail: string | null;
}

function classifyNetworkError(message: string): { dns: boolean | null; tls: boolean | null } {
  const m = message.toLowerCase();
  if (/dns|name not resolved|getaddrinfo|failed to lookup/.test(m)) return { dns: false, tls: null };
  if (/tls|certificate|ssl|handshake/.test(m)) return { dns: true, tls: false };
  return { dns: null, tls: null };
}

/**
 * Diagnóstico separado DNS/TLS/HTTP/WSDL usando GET no ?WSDL.
 * HEAD não é usado (o IIS do ISSNet não o trata de forma confiável).
 */
export async function diagnoseWebService(
  env?: string | null,
  timeoutMs: number = WS_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<DiagnosticsResult> {
  const endpoint = getEndpoint(env);
  const base: DiagnosticsResult = {
    reachable: false,
    url: endpoint.wsdlUrl,
    dns: null,
    tls: null,
    http: null,
    http_status: null,
    wsdl: null,
    wsdl_operations: [],
    detail: null,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint.wsdlUrl, {
      method: 'GET',
      headers: { Accept: 'text/xml, application/xml, */*' },
      signal: controller.signal,
    });
    base.dns = true;
    base.tls = endpoint.wsdlUrl.startsWith('https://');
    base.http = true;
    base.http_status = res.status;

    const text = await res.text();
    if (!res.ok) {
      base.detail = `HTTP ${res.status}`;
      base.wsdl = false;
      return base;
    }

    const parsed = parseWsdlOperations(text);
    base.wsdl = parsed.valid;
    base.wsdl_operations = parsed.operations;
    base.reachable = parsed.valid;
    if (!parsed.valid) base.detail = 'Resposta recebida não é um WSDL ABRASF válido.';
    return base;
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === 'AbortError';
    const message = isAbort ? `timeout (${timeoutMs}ms)` : ((e as Error)?.message ?? 'erro de rede');
    const classified = isAbort ? { dns: null, tls: null } : classifyNetworkError(message);
    base.dns = classified.dns;
    base.tls = classified.tls;
    base.http = false;
    base.detail = message;
    return base;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Valida o WSDL retornado: namespace ABRASF e presença das operações usadas. */
export function parseWsdlOperations(wsdl: string): { valid: boolean; operations: string[] } {
  const operations = Array.from(
    new Set(Array.from(wsdl.matchAll(/soapAction="([^"]+)"/g)).map((m) => m[1].split('/').pop() as string))
  );
  const hasNamespace = wsdl.includes(WS_NAMESPACE);
  const valid = hasNamespace && operations.includes('GerarNfse');
  return { valid, operations };
}

/** Validação de município e série exigidos pelo SGISS. */
export function validateMunicipalityAndSeries(
  municipalityCode?: string | null,
  rpsSeries?: string | null
): string[] {
  const errors: string[] = [];
  const code = (municipalityCode ?? '').replace(/\D/g, '');
  if (code !== GOIANIA_MUNICIPALITY_CODE) {
    errors.push(
      `Código do município inválido ("${municipalityCode ?? 'vazio'}"). O SGISS de Goiânia exige ${GOIANIA_MUNICIPALITY_CODE}.`
    );
  }
  const series = (rpsSeries ?? '').trim();
  if (series !== REQUIRED_RPS_SERIES) {
    errors.push(`Série do RPS inválida ("${rpsSeries ?? 'vazio'}"). O SGISS de Goiânia exige a série ${REQUIRED_RPS_SERIES}.`);
  }
  return errors;
}
