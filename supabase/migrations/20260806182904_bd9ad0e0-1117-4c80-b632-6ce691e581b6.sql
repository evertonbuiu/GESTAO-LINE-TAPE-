ALTER TABLE public.nfse_config
  ADD COLUMN IF NOT EXISTS provider_cnpj character varying,
  ADD COLUMN IF NOT EXISTS provider_im character varying,
  ADD COLUMN IF NOT EXISTS simple_national boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS iss_retention_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_exigibility integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.nfse_config.provider_im IS 'Inscricao Municipal do prestador (SGISS Goiania)';
COMMENT ON COLUMN public.nfse_config.service_exigibility IS '1 = Exigivel (ABRASF ExigibilidadeISS)';