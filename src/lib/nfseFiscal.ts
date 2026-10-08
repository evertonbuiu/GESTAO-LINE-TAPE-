// Padrões fiscais do prestador (Letra 3D line tape) para NFS-e de Goiânia/GO — SGISS/ABRASF 2.04.
// Valores confirmados em NFS-e real já autorizada da própria empresa.
// Nenhum dado de tomador é armazenado aqui.

export interface ProviderFiscalDefaults {
  provider_cnpj: string;
  provider_im: string;
  municipality_code: string;
  municipality_name: string;
  state: string;
  rps_series: string;
  /** Código de Tributação do Município = Item da Lista LC 116/2003. */
  service_code: string;
  cnae_code: string;
  iss_rate: number;
  iss_retention: boolean;
  simple_national: boolean;
  /** ABRASF ExigibilidadeISS: 1 = Exigível. */
  service_exigibility: number;
}

export const PROVIDER_FISCAL_DEFAULTS: ProviderFiscalDefaults = {
  provider_cnpj: '42089948000105',
  provider_im: '5412455',
  municipality_code: '5208707',
  municipality_name: 'Goiânia',
  state: 'GO',
  rps_series: '1',
  service_code: '12.12',
  cnae_code: '9001906',
  iss_rate: 2.0,
  iss_retention: false,
  simple_national: true,
  service_exigibility: 1,
};

export const DEFAULT_SERVICE_CODE = PROVIDER_FISCAL_DEFAULTS.service_code;
export const REQUIRED_RPS_SERIES = PROVIDER_FISCAL_DEFAULTS.rps_series;
export const PROVIDER_IM = PROVIDER_FISCAL_DEFAULTS.provider_im;

export interface ServiceCodeOption {
  code: string;
  label: string;
  /** Termos que caracterizam o serviço; usados para alertar divergência. */
  keywords: string[];
}

/** Códigos LC 116/2003 usados pela empresa. Outros podem ser digitados manualmente. */
export const SERVICE_CODE_OPTIONS: ServiceCodeOption[] = [
  {
    code: '12.12',
    label: '12.12 — Execução de música',
    keywords: [
      'musica', 'musical', 'show', 'espetaculo', 'banda', 'dj', 'sonorizacao', 'som',
      'audio', 'apresentacao', 'execucao musical', 'palco', 'iluminacao cenica', 'evento',
    ],
  },
  {
    code: '12.13',
    label: '12.13 — Produção de espetáculos, entrevistas e congêneres',
    keywords: ['producao', 'espetaculo', 'entrevista', 'show', 'evento'],
  },
  {
    code: '3.05',
    label: '3.05 — Cessão de andaimes, palcos, coberturas e estruturas',
    keywords: ['andaime', 'palco', 'cobertura', 'estrutura', 'locacao', 'cessao', 'box truss'],
  },
  {
    code: '14.01',
    label: '14.01 — Manutenção e conservação de máquinas e equipamentos',
    keywords: ['manutencao', 'conservacao', 'reparo', 'equipamento'],
  },
];

export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const findServiceCodeOption = (code: string): ServiceCodeOption | undefined =>
  SERVICE_CODE_OPTIONS.find((o) => o.code === code.trim());

/**
 * Alerta (não bloqueia) quando a descrição do serviço não corresponde ao código
 * selecionado — em especial ao padrão 12.12 (Execução de música).
 */
export function shouldWarnServiceDescription(code: string, description: string): boolean {
  const option = findServiceCodeOption(code);
  if (!option) return false;
  const text = normalizeText(description ?? '').trim();
  if (text.length < 3) return false;
  return !option.keywords.some((k) => text.includes(normalizeText(k)));
}

export function serviceDescriptionWarning(code: string, description: string): string | null {
  if (!shouldWarnServiceDescription(code, description)) return null;
  const option = findServiceCodeOption(code);
  return `A descrição informada não parece corresponder ao código ${option?.code ?? code} (${
    option?.label.split('—')[1]?.trim() ?? 'serviço selecionado'
  }). Confirme o código de serviço antes de gerar o RPS.`;
}

/** Validação dos padrões fiscais do prestador exigidos pelo SGISS/Goiânia. */
export function validateProviderFiscalDefaults(config: {
  provider_im?: string | null;
  rps_series?: string | null;
  default_service_code?: string | null;
}): string[] {
  const errors: string[] = [];
  const im = (config.provider_im ?? '').replace(/\D/g, '');
  if (im !== PROVIDER_IM) {
    errors.push(
      `Inscrição Municipal do prestador inválida ("${config.provider_im ?? 'vazio'}"). Esperado ${PROVIDER_IM}.`
    );
  }
  if ((config.rps_series ?? '').trim() !== REQUIRED_RPS_SERIES) {
    errors.push(`Série do RPS inválida ("${config.rps_series ?? 'vazio'}"). Esperado ${REQUIRED_RPS_SERIES}.`);
  }
  if ((config.default_service_code ?? '').trim() !== DEFAULT_SERVICE_CODE) {
    errors.push(
      `Código de serviço padrão inválido ("${config.default_service_code ?? 'vazio'}"). Esperado ${DEFAULT_SERVICE_CODE}.`
    );
  }
  return errors;
}
