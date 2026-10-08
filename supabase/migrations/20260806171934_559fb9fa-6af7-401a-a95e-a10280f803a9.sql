DROP POLICY IF EXISTS "Financeiro full access" ON public.nfse_certificates;

DROP POLICY IF EXISTS "Allow anon to delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to view certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view certificates" ON storage.objects;
DROP POLICY IF EXISTS "nfse_certificates_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "nfse_certificates_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "nfse_certificates_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "nfse_certificates_admin_delete" ON storage.objects;

CREATE POLICY "nfse_certificates_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'nfse-certificates' AND public.is_current_user_admin());

CREATE POLICY "nfse_certificates_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfse-certificates' AND public.is_current_user_admin());

CREATE POLICY "nfse_certificates_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'nfse-certificates' AND public.is_current_user_admin())
  WITH CHECK (bucket_id = 'nfse-certificates' AND public.is_current_user_admin());

CREATE POLICY "nfse_certificates_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'nfse-certificates' AND public.is_current_user_admin());