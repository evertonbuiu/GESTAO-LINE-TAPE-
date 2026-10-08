// Padrões fiscais do prestador (LINE TAPE) para o SGISS/Goiânia.
// Espelha src/lib/nfseFiscal.ts — mantido aqui porque o deploy da Edge Function
// só inclui arquivos sob supabase/functions/.

export const PROVIDER_IM = '5412455';
export const PROVIDER_CNPJ = '42089948000105';
export const DEFAULT_SERVICE_CODE = '12.12';
export const DEFAULT_CNAE = '9001906';
export const DEFAULT_ISS_RATE = 2.0;
export const RPS_SERIES = '1';

/** Valida IM do prestador, série do RPS e código de serviço padrão. */
export function validateProviderFiscalDefaults(config: {
  provider_im?: string | null;
  rps_series?: string | null;
  default_service_code?: string | null;
}): string[] {
  const errors: string[] = [];
  const im = (config.provider_im ?? '').replace(/\D/g, '');
  if (im !== PROVIDER_IM) {
    errors.push(
      `Inscrição Municipal do prestador inválida ("${config.provider_im ?? 'vazio'}"). O cadastro da empresa em Goiânia é ${PROVIDER_IM}.`
    );
  }
  if ((config.rps_series ?? '').trim() !== RPS_SERIES) {
    errors.push(`Série do RPS inválida ("${config.rps_series ?? 'vazio'}"). O SGISS exige a série ${RPS_SERIES}.`);
  }
  if ((config.default_service_code ?? '').trim() !== DEFAULT_SERVICE_CODE) {
    errors.push(
      `Código de serviço padrão inválido ("${config.default_service_code ?? 'vazio'}"). O padrão da empresa é ${DEFAULT_SERVICE_CODE} (Execução de música).`
    );
  }
  return errors;
}
