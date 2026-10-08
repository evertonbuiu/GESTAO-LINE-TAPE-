-- Allow access for role anon as the frontend is currently using anon JWT (custom auth does not create a Supabase authenticated session)

-- nfse_invoices
ALTER TABLE public.nfse_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_invoices_select_anon ON public.nfse_invoices;
DROP POLICY IF EXISTS nfse_invoices_insert_anon ON public.nfse_invoices;
DROP POLICY IF EXISTS nfse_invoices_update_anon ON public.nfse_invoices;
DROP POLICY IF EXISTS nfse_invoices_delete_anon ON public.nfse_invoices;
CREATE POLICY nfse_invoices_select_anon ON public.nfse_invoices FOR SELECT TO anon USING (true);
CREATE POLICY nfse_invoices_insert_anon ON public.nfse_invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY nfse_invoices_update_anon ON public.nfse_invoices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY nfse_invoices_delete_anon ON public.nfse_invoices FOR DELETE TO anon USING (true);

-- nfse_config
ALTER TABLE public.nfse_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_config_select_anon ON public.nfse_config;
DROP POLICY IF EXISTS nfse_config_insert_anon ON public.nfse_config;
DROP POLICY IF EXISTS nfse_config_update_anon ON public.nfse_config;
DROP POLICY IF EXISTS nfse_config_delete_anon ON public.nfse_config;
CREATE POLICY nfse_config_select_anon ON public.nfse_config FOR SELECT TO anon USING (true);
CREATE POLICY nfse_config_insert_anon ON public.nfse_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY nfse_config_update_anon ON public.nfse_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY nfse_config_delete_anon ON public.nfse_config FOR DELETE TO anon USING (true);

-- nfse_certificates
ALTER TABLE public.nfse_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_certificates_select_anon ON public.nfse_certificates;
DROP POLICY IF EXISTS nfse_certificates_insert_anon ON public.nfse_certificates;
DROP POLICY IF EXISTS nfse_certificates_update_anon ON public.nfse_certificates;
DROP POLICY IF EXISTS nfse_certificates_delete_anon ON public.nfse_certificates;
CREATE POLICY nfse_certificates_select_anon ON public.nfse_certificates FOR SELECT TO anon USING (true);
CREATE POLICY nfse_certificates_insert_anon ON public.nfse_certificates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY nfse_certificates_update_anon ON public.nfse_certificates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY nfse_certificates_delete_anon ON public.nfse_certificates FOR DELETE TO anon USING (true);