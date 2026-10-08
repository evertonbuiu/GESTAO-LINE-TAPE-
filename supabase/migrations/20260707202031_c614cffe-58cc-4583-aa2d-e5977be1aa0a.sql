
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['user_credentials','user_roles','user_permissions','role_permissions','permissions','profiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END$$;
