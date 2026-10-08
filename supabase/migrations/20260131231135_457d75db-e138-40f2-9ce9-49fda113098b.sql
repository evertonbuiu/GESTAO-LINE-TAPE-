-- Drop existing policies first to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can view all invoices" ON public.nfse_invoices;
DROP POLICY IF EXISTS "Authenticated users can create invoices" ON public.nfse_invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.nfse_invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.nfse_invoices;
DROP POLICY IF EXISTS "Authenticated users can view config" ON public.nfse_config;
DROP POLICY IF EXISTS "Authenticated users can insert config" ON public.nfse_config;
DROP POLICY IF EXISTS "Authenticated users can update config" ON public.nfse_config;
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON public.nfse_certificates;
DROP POLICY IF EXISTS "Authenticated users can insert certificates" ON public.nfse_certificates;
DROP POLICY IF EXISTS "Authenticated users can update certificates" ON public.nfse_certificates;
DROP POLICY IF EXISTS "Authenticated users can delete certificates" ON public.nfse_certificates;
DROP POLICY IF EXISTS "Authenticated users can manage config" ON public.nfse_config;
DROP POLICY IF EXISTS "Authenticated users can manage certificates" ON public.nfse_certificates;

-- Recreate all policies for nfse_invoices
CREATE POLICY "nfse_invoices_select" ON public.nfse_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfse_invoices_insert" ON public.nfse_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nfse_invoices_update" ON public.nfse_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nfse_invoices_delete" ON public.nfse_invoices FOR DELETE TO authenticated USING (true);

-- Recreate all policies for nfse_config
CREATE POLICY "nfse_config_select" ON public.nfse_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfse_config_insert" ON public.nfse_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nfse_config_update" ON public.nfse_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Recreate all policies for nfse_certificates
CREATE POLICY "nfse_certificates_select" ON public.nfse_certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfse_certificates_insert" ON public.nfse_certificates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nfse_certificates_update" ON public.nfse_certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nfse_certificates_delete" ON public.nfse_certificates FOR DELETE TO authenticated USING (true);