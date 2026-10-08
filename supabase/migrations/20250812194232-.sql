-- Ensure RLS and permissive policies for public.company_settings so updates persist with anon key
-- Idempotent: create policies only if missing

-- Enable RLS
ALTER TABLE IF EXISTS public.company_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_settings' AND policyname = 'Public read company settings'
  ) THEN
    CREATE POLICY "Public read company settings"
    ON public.company_settings
    FOR SELECT
    USING (true);
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_settings' AND policyname = 'Public insert company settings'
  ) THEN
    CREATE POLICY "Public insert company settings"
    ON public.company_settings
    FOR INSERT
    WITH CHECK (true);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_settings' AND policyname = 'Public update company settings'
  ) THEN
    CREATE POLICY "Public update company settings"
    ON public.company_settings
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;

  -- Optional DELETE policy (not strictly required but keeps table manageable from UI)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_settings' AND policyname = 'Public delete company settings'
  ) THEN
    CREATE POLICY "Public delete company settings"
    ON public.company_settings
    FOR DELETE
    USING (true);
  END IF;
END
$$;