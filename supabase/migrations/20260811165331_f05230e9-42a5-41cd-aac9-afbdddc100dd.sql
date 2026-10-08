DROP POLICY IF EXISTS "Anon users can upload product images"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload worker-receipts"                ON storage.objects;
DROP POLICY IF EXISTS "Allow update worker-receipts"                ON storage.objects;
DROP POLICY IF EXISTS "Allow delete worker-receipts"                ON storage.objects;
DROP POLICY IF EXISTS "Public access to worker-receipts"            ON storage.objects;

CREATE OR REPLACE FUNCTION public.storage_path_is_safe(_name text, _exts text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _name IS NOT NULL
     AND _name !~ '\.\.'
     AND _name !~ '^/'
     AND _name !~ '//'
     AND length(_name) <= 300
     AND lower(regexp_replace(_name, '^.*\.', '')) = ANY (_exts);
$$;

REVOKE ALL ON FUNCTION public.storage_path_is_safe(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_path_is_safe(text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.storage_path_is_safe(text, text[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "product_images_insert_stock_roles" ON storage.objects;
CREATE POLICY "product_images_insert_stock_roles"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS "product_images_update_stock_roles" ON storage.objects;
CREATE POLICY "product_images_update_stock_roles"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS "product_images_delete_stock_roles" ON storage.objects;
CREATE POLICY "product_images_delete_stock_roles"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
);

DROP POLICY IF EXISTS "worker_receipts_select_owner_or_finance" ON storage.objects;
CREATE POLICY "worker_receipts_select_owner_or_finance"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'worker-receipts'
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR owner = auth.uid()
    OR name LIKE 'receipts/' || auth.uid()::text || '-%'
  )
);

DROP POLICY IF EXISTS "worker_receipts_insert_owner_or_finance" ON storage.objects;
CREATE POLICY "worker_receipts_insert_owner_or_finance"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'worker-receipts'
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR name LIKE 'receipts/' || auth.uid()::text || '-%'
  )
);

DROP POLICY IF EXISTS "worker_receipts_update_owner_or_finance" ON storage.objects;
CREATE POLICY "worker_receipts_update_owner_or_finance"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'worker-receipts'
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR owner = auth.uid()
    OR name LIKE 'receipts/' || auth.uid()::text || '-%'
  )
)
WITH CHECK (
  bucket_id = 'worker-receipts'
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR name LIKE 'receipts/' || auth.uid()::text || '-%'
  )
);

DROP POLICY IF EXISTS "worker_receipts_delete_admin_finance" ON storage.objects;
CREATE POLICY "worker_receipts_delete_admin_finance"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'worker-receipts'
  AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
);

ALTER FUNCTION public.current_user_has_any_role(text[])   SET search_path = public;
ALTER FUNCTION public.is_current_user_admin()             SET search_path = public;
ALTER FUNCTION public.has_permission(uuid, text, text)    SET search_path = public;

REVOKE ALL ON FUNCTION public.current_user_has_any_role(text[])  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_user_admin()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin()           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text)  TO authenticated, service_role;