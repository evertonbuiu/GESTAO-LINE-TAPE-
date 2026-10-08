ALTER TABLE public.nfse_config
  ADD COLUMN IF NOT EXISTS national_homologation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS national_transmission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS national_registration_status text NOT NULL DEFAULT 'nao_solicitado',
  ADD COLUMN IF NOT EXISTS national_registration_confirmed_at timestamptz;

ALTER TABLE public.nfse_config
  DROP CONSTRAINT IF EXISTS nfse_config_national_registration_status_check;

ALTER TABLE public.nfse_config
  ADD CONSTRAINT nfse_config_national_registration_status_check
  CHECK (national_registration_status IN ('nao_solicitado', 'solicitado', 'aprovado', 'recusado'));