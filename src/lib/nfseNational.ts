// Constantes e regras (frontend) da homologação NFS-e Padrão Nacional / DPS.
// Espelha o adaptador Edge separado `nfse-nacional-homologacao`.
// Não interfere com o fluxo ABRASF 2.04 de produção.

export const NATIONAL_HOMOLOGATION_URL =
  'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx';
export const NATIONAL_MANUAL_VERSION = '1.01';
export const NATIONAL_MANUAL_URL =
  'https://www.notacontrol.com.br/download/nfse/Manual_integracao_v101.pdf';
export const NATIONAL_NOT_A_FISCAL_DOCUMENT =
  'Ambiente de homologação — não vale como nota fiscal.';

export const NATIONAL_EDGE_FUNCTION = 'nfse-nacional-homologacao';

export type NationalRegistrationStatus =
  | 'nao_solicitado'
  | 'solicitado'
  | 'aprovado'
  | 'recusado';

export const NATIONAL_REGISTRATION_LABELS: Record<NationalRegistrationStatus, string> = {
  nao_solicitado: 'Cadastro não solicitado',
  solicitado: 'Cadastro solicitado — aguardando prefeitura',
  aprovado: 'Cadastro aprovado',
  recusado: 'Cadastro recusado',
};

export interface NationalConfigState {
  national_homologation_enabled?: boolean | null;
  national_transmission_enabled?: boolean | null;
  national_registration_status?: string | null;
}

/**
 * Transmissão do padrão nacional é sempre bloqueada nesta fase (somente prévia),
 * mesmo com cadastro aprovado e flags ligadas.
 */
export function canTransmitNational(_config: NationalConfigState | null): boolean {
  return false;
}

export function nationalBlockReasons(config: NationalConfigState | null): string[] {
  const reasons: string[] = [];
  if (!config?.national_homologation_enabled) reasons.push('Homologação nacional não habilitada.');
  if (config?.national_registration_status !== 'aprovado') {
    reasons.push('Cadastro/credenciamento de homologação ainda não aprovado.');
  }
  if (!config?.national_transmission_enabled) reasons.push('Transmissão desativada por padrão.');
  reasons.push('Adaptador em modo somente prévia.');
  return reasons;
}

/** Isolamento: a URL nacional nunca pode apontar para o adaptador ABRASF de produção. */
export function isIsolatedFromProduction(url: string): boolean {
  return url.includes('/wsnfsenacional/homologacao/') && !url.includes('abrasf204');
}
