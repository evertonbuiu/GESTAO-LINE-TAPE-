// Regras puras de validação para emissão direta de NFS-e (Goiânia/GO).
// Mantidas fora do componente para permitir testes unitários.

export interface NFSeReadinessConfig {
  is_configured?: boolean | null;
  municipality_code?: string | null;
  default_service_code?: string | null;
  default_iss_rate?: number | null;
  environment?: string | null;
  active_certificate_id?: string | null;
}

export interface NFSeReadinessCertificate {
  id: string;
  is_active: boolean;
  valid_until?: string | null;
}

export interface NFSeReadiness {
  ready: boolean;
  environment: 'producao' | 'homologacao' | 'desconhecido';
  isProduction: boolean;
  blockers: string[];
  certificateExpired: boolean;
}

/** Status a partir dos quais é permitido transmitir. `error` exige confirmação de reenvio. */
export const EMITTABLE_STATUSES = ['rps_generated', 'error'] as const;

export const canEmitStatus = (status: string): boolean =>
  (EMITTABLE_STATUSES as readonly string[]).includes(status);

export const isResend = (status: string): boolean => status === 'error';

export const normalizeEnvironment = (env?: string | null): NFSeReadiness['environment'] => {
  const value = (env ?? '').toLowerCase();
  if (value === 'producao' || value === 'production' || value === '1') return 'producao';
  if (value === 'homologacao' || value === 'homologation' || value === '2') return 'homologacao';
  return 'desconhecido';
};

export const isCertificateExpired = (validUntil?: string | null, now: Date = new Date()): boolean => {
  if (!validUntil) return false;
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < now.getTime();
};

export function evaluateNFSeReadiness(
  config: NFSeReadinessConfig | null,
  certificates: NFSeReadinessCertificate[],
  now: Date = new Date()
): NFSeReadiness {
  const blockers: string[] = [];
  const environment = normalizeEnvironment(config?.environment);

  if (!config) {
    blockers.push('Configuração fiscal não encontrada.');
  } else {
    if (!config.municipality_code) blockers.push('Código do município não configurado.');
    if (!config.default_service_code) blockers.push('Código de serviço padrão não configurado.');
    if (!config.default_iss_rate) blockers.push('Alíquota de ISS não configurada.');
    if (!config.is_configured) blockers.push('Configuração fiscal marcada como incompleta.');
    if (environment === 'desconhecido') blockers.push('Ambiente (produção/homologação) não definido.');
  }

  const activeCert =
    certificates.find((c) => c.id === config?.active_certificate_id && c.is_active) ??
    certificates.find((c) => c.is_active) ??
    null;

  let certificateExpired = false;
  if (!activeCert) {
    blockers.push('Nenhum certificado digital A1 ativo.');
  } else {
    certificateExpired = isCertificateExpired(activeCert.valid_until, now);
    if (certificateExpired) blockers.push('Certificado digital A1 expirado.');
    if (!config?.active_certificate_id) blockers.push('Certificado não vinculado à configuração fiscal.');
  }

  return {
    ready: blockers.length === 0,
    environment,
    isProduction: environment === 'producao',
    blockers,
    certificateExpired,
  };
}

/** Extrai mensagem legível de um erro retornado pela Edge Function. */
export function describeEmitError(payload: unknown, fallback = 'Erro desconhecido ao emitir a NFS-e'): string {
  if (!payload) return friendlyInvokeError(fallback);
  if (typeof payload === 'string') return friendlyInvokeError(payload);
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(p.errors) && p.errors.length) parts.push(p.errors.join('; '));
  else if (typeof p.error === 'string') parts.push(p.error);
  if (typeof p.instructions === 'string') parts.push(p.instructions);
  if (typeof p.details === 'string' && !parts.length) parts.push(p.details);
  if (p.reconciliation_required === true && !parts.some((s) => s.includes('RPS'))) {
    parts.push('Consulte a nota pelo número do RPS antes de reenviar.');
  }
  return parts.length ? parts.join(' — ') : friendlyInvokeError(fallback);
}

/** Traduz erros genéricos do supabase-js em orientação acionável. */
export function friendlyInvokeError(message: string): string {
  if (/Failed to (send|fetch) a request|Failed to fetch|NetworkError/i.test(message)) {
    return 'Não foi possível contatar a função de emissão (rede ou função indisponível). Nenhuma nota foi transmitida — use "Validar certificado e conexão" e tente novamente.';
  }
  if (/aborted|timeout/i.test(message)) {
    return 'Tempo esgotado ao aguardar a função de emissão. Consulte a nota pelo RPS antes de reenviar.';
  }
  return message;
}

/** Descreve o resultado do preflight (validação de certificado e conectividade). */
export interface PreflightResult {
  ready?: boolean;
  error?: string | null;
  error_code?: string | null;
  instructions?: string | null;
  checks?: Record<string, unknown> | null;
}

export function describePreflight(result: PreflightResult | null): string {
  if (!result) return 'Não foi possível validar a configuração fiscal.';
  if (result.ready) return 'Certificado válido e WebService da Prefeitura acessível.';
  const parts = [result.error, result.instructions].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );
  return parts.length ? parts.join(' — ') : 'Configuração fiscal incompleta.';
}

