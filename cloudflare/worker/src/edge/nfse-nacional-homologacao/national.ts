// Copiado de supabase/functions/nfse-nacional-homologacao/national.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// Adaptador SEPARADO — NFS-e Padrão Nacional (DPS), ambiente de HOMOLOGAÇÃO.
// NÃO substitui nem altera o adaptador ABRASF 2.04 de produção (emit-nfse/webservice.ts).
// Fonte oficial (portal ISSNet/Goiânia, consultado em 13/03/2026):
//   Homologação: https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx
//   Manual de integração v1.01: https://www.notacontrol.com.br/download/nfse/Manual_integracao_v101.pdf
//
// Este módulo é SOMENTE LEITURA em relação à prefeitura: faz apenas GET ?WSDL.
// Nenhum método fiscal é chamado e nenhum documento é transmitido.

export const NATIONAL_LAYOUT_VERSION = '1.00';
export const NATIONAL_MANUAL_VERSION = '1.01';
export const NATIONAL_MANUAL_URL =
  'https://www.notacontrol.com.br/download/nfse/Manual_integracao_v101.pdf';

/** Namespace do XSD da NFS-e Padrão Nacional (SPED/RFB). */
export const DPS_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';

/** Endpoint OFICIAL de homologação do padrão nacional (ISSNet). */
export const NATIONAL_HOMOLOGATION_URL =
  'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx';
export const NATIONAL_HOMOLOGATION_WSDL = `${NATIONAL_HOMOLOGATION_URL}?WSDL`;

/** Endpoint ABRASF 2.04 de produção — mantido aqui apenas para garantir isolamento. */
export const LEGACY_ABRASF_PRODUCTION_URL =
  'https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx';

export const WS_TIMEOUT_MS = 30000;

/** Defaults confirmados na NFS-e real autorizada da própria empresa. */
export const NATIONAL_PROVIDER_DEFAULTS = {
  provider_cnpj: '42089948000105',
  provider_im: '5412455',
  municipality_code: '5208707',
  series: '1',
  /** Item LC 116/2003 12.12 → código nacional de serviço 12.12.01 (execução de música). */
  national_service_code: '120120100',
  lc116_item: '12.12',
  cnae_code: '9001906',
  simple_national: true,
  /** tribNac.tribISSQN: 1 = Operação tributável (ISS exigível). */
  iss_tributacao: 1,
  /** regTrib.opSimpNac: 2 = Optante do Simples Nacional — microempresa ou EPP. */
  op_simples_nacional: 2,
} as const;

export type NationalRegistrationStatus =
  | 'nao_solicitado'
  | 'solicitado'
  | 'aprovado'
  | 'recusado';

// ---------------------------------------------------------------------------
// Bloqueio de transmissão
// ---------------------------------------------------------------------------

export interface NationalConfigState {
  national_homologation_enabled?: boolean | null;
  national_transmission_enabled?: boolean | null;
  national_registration_status?: string | null;
}

export interface TransmissionGate {
  allowed: boolean;
  reasons: string[];
}

/**
 * Transmissão no padrão nacional é FALSA por padrão e só poderia ser liberada
 * com cadastro/credenciamento aprovado + confirmação explícita.
 * Nesta fase o adaptador nunca transmite — a função sempre reporta o bloqueio.
 */
export function evaluateTransmissionGate(config: NationalConfigState | null): TransmissionGate {
  const reasons: string[] = [];
  if (!config?.national_homologation_enabled) {
    reasons.push('Ambiente de homologação nacional não habilitado nas configurações.');
  }
  if (config?.national_registration_status !== 'aprovado') {
    reasons.push(
      `Cadastro/credenciamento de homologação não aprovado (situação atual: ${
        config?.national_registration_status ?? 'nao_solicitado'
      }).`
    );
  }
  if (!config?.national_transmission_enabled) {
    reasons.push('Transmissão nacional desativada (padrão de segurança).');
  }
  reasons.push('Adaptador em modo somente prévia: transmissão desabilitada no código.');
  return { allowed: false, reasons };
}

// ---------------------------------------------------------------------------
// Validação de identificação do prestador
// ---------------------------------------------------------------------------

export function validateNationalProvider(config: {
  provider_cnpj?: string | null;
  provider_im?: string | null;
  municipality_code?: string | null;
}): string[] {
  const errors: string[] = [];
  const cnpj = (config.provider_cnpj ?? '').replace(/\D/g, '');
  const im = (config.provider_im ?? '').replace(/\D/g, '');
  const mun = (config.municipality_code ?? '').replace(/\D/g, '');
  if (cnpj !== NATIONAL_PROVIDER_DEFAULTS.provider_cnpj) {
    errors.push(
      `CNPJ do prestador inválido ("${config.provider_cnpj ?? 'vazio'}"). Esperado ${NATIONAL_PROVIDER_DEFAULTS.provider_cnpj}.`
    );
  }
  if (im !== NATIONAL_PROVIDER_DEFAULTS.provider_im) {
    errors.push(
      `Inscrição Municipal inválida ("${config.provider_im ?? 'vazio'}"). Esperado ${NATIONAL_PROVIDER_DEFAULTS.provider_im}.`
    );
  }
  if (mun !== NATIONAL_PROVIDER_DEFAULTS.municipality_code) {
    errors.push(
      `Código do município inválido ("${config.municipality_code ?? 'vazio'}"). Esperado ${NATIONAL_PROVIDER_DEFAULTS.municipality_code}.`
    );
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Diagnóstico somente leitura (GET ?WSDL)
// ---------------------------------------------------------------------------

export interface NationalDiagnostics {
  reachable: boolean;
  url: string;
  tls: boolean | null;
  http: boolean | null;
  http_status: number | null;
  contract_valid: boolean | null;
  operations: string[];
  detail: string | null;
}

export function parseNationalWsdl(wsdl: string): { valid: boolean; operations: string[] } {
  const operations = Array.from(
    new Set(
      Array.from(wsdl.matchAll(/soapAction="([^"]*)"/g))
        .map((m) => m[1].split('/').pop() ?? '')
        .filter(Boolean)
    )
  );
  const looksLikeWsdl = /<(wsdl:)?definitions/i.test(wsdl);
  const valid = looksLikeWsdl && operations.length > 0;
  return { valid, operations };
}

export async function diagnoseNationalHomologation(
  timeoutMs: number = WS_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<NationalDiagnostics> {
  const base: NationalDiagnostics = {
    reachable: false,
    url: NATIONAL_HOMOLOGATION_WSDL,
    tls: null,
    http: null,
    http_status: null,
    contract_valid: null,
    operations: [],
    detail: null,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(NATIONAL_HOMOLOGATION_WSDL, {
      method: 'GET',
      headers: { Accept: 'text/xml, application/xml, */*' },
      signal: controller.signal,
    });
    base.tls = NATIONAL_HOMOLOGATION_WSDL.startsWith('https://');
    base.http = true;
    base.http_status = res.status;
    const text = await res.text();
    if (!res.ok) {
      base.contract_valid = false;
      base.detail = `HTTP ${res.status}`;
      return base;
    }
    const parsed = parseNationalWsdl(text);
    base.contract_valid = parsed.valid;
    base.operations = parsed.operations;
    base.reachable = parsed.valid;
    if (!parsed.valid) base.detail = 'Resposta recebida não é um WSDL válido.';
    return base;
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === 'AbortError';
    base.http = false;
    base.detail = isAbort ? `timeout (${timeoutMs}ms)` : ((e as Error)?.message ?? 'erro de rede');
    return base;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Gerador de PRÉVIA do XML da DPS (nunca transmitido)
// ---------------------------------------------------------------------------

export interface DpsPreviewInput {
  /** Número sequencial da DPS (numérico). */
  dps_number: string;
  series?: string;
  /** ISO date/datetime da emissão. */
  issue_date: string;
  /** ISO date da competência. */
  competence_date: string;
  taker_document?: string | null;
  taker_name?: string | null;
  taker_email?: string | null;
  service_description: string;
  service_value: number;
  national_service_code?: string | null;
  cnae_code?: string | null;
  municipality_code?: string | null;
  provider_cnpj?: string | null;
  provider_im?: string | null;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const onlyDigits = (v?: string | null) => (v ?? '').replace(/\D/g, '');

const toIsoDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
  return d.toISOString().replace(/\.\d{3}Z$/, '-03:00');
};

const toIsoDate = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};

/** Id da DPS: "DPS" + cMun(7) + tpInsc(1) + inscrição(14) + série(5) + nDPS(15). */
export function buildDpsId(input: {
  municipality_code: string;
  provider_cnpj: string;
  series: string;
  dps_number: string;
}): string {
  const mun = onlyDigits(input.municipality_code).padStart(7, '0');
  const cnpj = onlyDigits(input.provider_cnpj).padStart(14, '0');
  const serie = onlyDigits(input.series).padStart(5, '0');
  const numero = onlyDigits(input.dps_number).padStart(15, '0');
  return `DPS${mun}2${cnpj}${serie}${numero}`;
}

export function validateDpsInput(input: DpsPreviewInput): string[] {
  const errors: string[] = [];
  if (!onlyDigits(input.dps_number)) errors.push('Número da DPS é obrigatório.');
  if (!input.service_description || input.service_description.trim().length < 3) {
    errors.push('Discriminação do serviço é obrigatória.');
  }
  if (!(Number(input.service_value) > 0)) errors.push('Valor do serviço deve ser maior que zero.');
  const taker = onlyDigits(input.taker_document);
  if (taker && taker.length !== 11 && taker.length !== 14) {
    errors.push('Documento do tomador deve ter 11 (CPF) ou 14 (CNPJ) dígitos.');
  }
  errors.push(
    ...validateNationalProvider({
      provider_cnpj: input.provider_cnpj ?? NATIONAL_PROVIDER_DEFAULTS.provider_cnpj,
      provider_im: input.provider_im ?? NATIONAL_PROVIDER_DEFAULTS.provider_im,
      municipality_code: input.municipality_code ?? NATIONAL_PROVIDER_DEFAULTS.municipality_code,
    })
  );
  return errors;
}

/**
 * Gera a PRÉVIA do XML da DPS conforme o XSD/manual v1.01.
 * IMPORTANTE: no padrão nacional a alíquota NÃO é informada pelo contribuinte
 * (o cálculo do ISSQN é feito pelo ambiente nacional). Por isso nenhum campo
 * de alíquota/valor de ISS é emitido aqui.
 */
export function buildDpsPreviewXml(input: DpsPreviewInput): string {
  const municipality = onlyDigits(input.municipality_code) || NATIONAL_PROVIDER_DEFAULTS.municipality_code;
  const cnpj = onlyDigits(input.provider_cnpj) || NATIONAL_PROVIDER_DEFAULTS.provider_cnpj;
  const im = onlyDigits(input.provider_im) || NATIONAL_PROVIDER_DEFAULTS.provider_im;
  const series = onlyDigits(input.series) || NATIONAL_PROVIDER_DEFAULTS.series;
  const serviceCode = onlyDigits(input.national_service_code) || NATIONAL_PROVIDER_DEFAULTS.national_service_code;
  const cnae = onlyDigits(input.cnae_code) || NATIONAL_PROVIDER_DEFAULTS.cnae_code;
  const id = buildDpsId({ municipality_code: municipality, provider_cnpj: cnpj, series, dps_number: input.dps_number });
  const takerDoc = onlyDigits(input.taker_document);

  const tomador = takerDoc
    ? `
      <toma>
        ${takerDoc.length === 14 ? `<CNPJ>${takerDoc}</CNPJ>` : `<CPF>${takerDoc}</CPF>`}
        <xNome>${escapeXml(input.taker_name ?? 'CONSUMIDOR FINAL')}</xNome>${
        input.taker_email ? `\n        <email>${escapeXml(input.taker_email)}</email>` : ''
      }
      </toma>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${DPS_NAMESPACE}" versao="${NATIONAL_LAYOUT_VERSION}">
  <infDPS Id="${id}">
    <tpAmb>2</tpAmb>
    <dhEmi>${toIsoDateTime(input.issue_date)}</dhEmi>
    <verAplic>LINETAPE-2026</verAplic>
    <serie>${series}</serie>
    <nDPS>${onlyDigits(input.dps_number)}</nDPS>
    <dCompet>${toIsoDate(input.competence_date)}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${municipality}</cLocEmi>
    <prest>
      <CNPJ>${cnpj}</CNPJ>
      <IM>${im}</IM>
      <regTrib>
        <opSimpNac>${NATIONAL_PROVIDER_DEFAULTS.op_simples_nacional}</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>${tomador}
    <serv>
      <locPrest>
        <cLocPrestacao>${municipality}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${serviceCode}</cTribNac>
        <xDescServ>${escapeXml(input.service_description)}</xDescServ>
        <cNBS>${cnae}</cNBS>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${Number(input.service_value).toFixed(2)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${NATIONAL_PROVIDER_DEFAULTS.iss_tributacao}</tribISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}

/** Nenhuma alíquota pode constar na DPS (manual v1.01). */
export function containsForbiddenAliquota(xml: string): boolean {
  return /<(pAliq|aliquota|Aliquota|vISS|ValorIss)\b/i.test(xml);
}
