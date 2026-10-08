// Copiado de supabase/functions/fiscal-document/fiscal.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// Regras fiscais espelhadas de src/lib/fiscal.ts (o deploy da Edge Function só
// inclui arquivos sob supabase/functions/). Nada aqui simula autorização.

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '');

export const isValidAccessKey = (value: string): boolean =>
  /^[0-9]{44}$/.test(onlyDigits(value));

export function accessKeyCheckDigitValid(value: string): boolean {
  const k = onlyDigits(value);
  if (k.length !== 44) return false;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = 42, w = 0; i >= 0; i -= 1, w += 1) {
    sum += Number(k[i]) * weights[w % weights.length];
  }
  const rest = sum % 11;
  const dv = rest === 0 || rest === 1 ? 0 : 11 - rest;
  return dv === Number(k[43]);
}

export const modelFromAccessKey = (value: string): string | null => {
  const k = onlyDigits(value);
  return k.length === 44 ? k.slice(20, 22) : null;
};

export interface ParsedAuthorizedXml {
  ok: boolean;
  error?: string;
  access_key?: string;
  protocol_number?: string;
  authorized_at?: string;
  model?: string;
  environment?: 'homologacao' | 'producao';
  total_document_cents?: number;
}

const pick = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
};

/** Só aceita XML com protocolo real de autorização. */
export function parseAuthorizedXml(xml: string): ParsedAuthorizedXml {
  if (!xml || !xml.includes('<')) return { ok: false, error: 'Arquivo XML inválido.' };

  const hasProt = /<prot(NFe|MDFe|CTe)\b/i.test(xml) || /<infProt\b/i.test(xml);
  if (!hasProt) {
    return { ok: false, error: 'XML sem protocolo de autorização da SEFAZ (protNFe/protMDFe/protCTe).' };
  }

  const cStat = pick(xml, 'cStat');
  if (cStat && !['100', '150', '132'].includes(cStat)) {
    return { ok: false, error: `XML não autorizado pela SEFAZ (cStat ${cStat}).` };
  }

  const key = onlyDigits(pick(xml, 'chNFe') ?? pick(xml, 'chMDFe') ?? pick(xml, 'chCTe') ?? '');
  if (!isValidAccessKey(key)) return { ok: false, error: 'Chave de acesso ausente ou inválida no XML.' };
  if (!accessKeyCheckDigitValid(key)) {
    return { ok: false, error: 'Dígito verificador da chave de acesso inválido.' };
  }

  const protocol = pick(xml, 'nProt');
  if (!protocol) return { ok: false, error: 'Número de protocolo ausente no XML.' };

  const authorizedAt = pick(xml, 'dhRecbto');
  if (!authorizedAt) return { ok: false, error: 'Data/hora de autorização ausente no XML.' };

  const tpAmb = pick(xml, 'tpAmb');
  const environment: 'homologacao' | 'producao' = tpAmb === '1' ? 'producao' : 'homologacao';

  const vNF = pick(xml, 'vNF') ?? pick(xml, 'vTPrest');
  const totalCents = vNF ? Math.round(Number(vNF) * 100) : undefined;

  return {
    ok: true,
    access_key: key,
    protocol_number: protocol,
    authorized_at: authorizedAt,
    model: modelFromAccessKey(key) ?? undefined,
    environment,
    total_document_cents: Number.isFinite(totalCents as number) ? totalCents : undefined,
  };
}

export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Diagnóstico de credenciais (modo seguro de preparação)
// ---------------------------------------------------------------------------

export const REQUIRED_SECRETS = [
  'FISCAL_PROVIDER_URL',
  'FISCAL_PROVIDER_API_KEY',
  'FISCAL_CERT_A1_BASE64',
  'FISCAL_CERT_A1_PASSWORD',
] as const;

export interface SecretsDiagnostics {
  configured: boolean;
  missing: string[];
  present: string[];
}

export function diagnoseSecrets(env: (key: string) => string | undefined): SecretsDiagnostics {
  const missing: string[] = [];
  const present: string[] = [];
  for (const name of REQUIRED_SECRETS) {
    if ((env(name) ?? '').trim()) present.push(name);
    else missing.push(name);
  }
  return { configured: missing.length === 0, missing, present };
}

export const TRANSMISSION_BLOCKED_MESSAGE =
  'Transmissão bloqueada: o ambiente ainda não possui provedor de emissão e certificado A1 configurados. ' +
  'Nenhum documento foi enviado e nada foi marcado como autorizado.';
