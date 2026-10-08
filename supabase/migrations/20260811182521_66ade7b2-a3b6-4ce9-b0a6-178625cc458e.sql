-- 1) Remover policies permissivas antigas (role public / sem checagem de login)
DROP POLICY IF EXISTS "Public access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete equipment-images" ON storage.objects;

-- 2) receipts: privado, admin/financeiro ou dono
DROP POLICY IF EXISTS receipts_select_finance_or_owner ON storage.objects;
CREATE POLICY receipts_select_finance_or_owner ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR owner = auth.uid()
    OR name LIKE 'expense-advance-receipts/' || auth.uid()::text || '-%'
  )
);

DROP POLICY IF EXISTS receipts_insert_finance_or_owner ON storage.objects;
CREATE POLICY receipts_insert_finance_or_owner ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR name LIKE 'expense-advance-receipts/' || auth.uid()::text || '-%'
  )
);

DROP POLICY IF EXISTS receipts_update_finance ON storage.objects;
CREATE POLICY receipts_update_finance ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND public.current_user_has_any_role(ARRAY['admin','financeiro']))
WITH CHECK (
  bucket_id = 'receipts'
  AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS receipts_delete_finance ON storage.objects;
CREATE POLICY receipts_delete_finance ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND public.current_user_has_any_role(ARRAY['admin','financeiro']));

-- 3) expense-receipts: mesma regra, prefixo <uid>/
DROP POLICY IF EXISTS expense_receipts_select_finance_or_owner ON storage.objects;
CREATE POLICY expense_receipts_select_finance_or_owner ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR owner = auth.uid()
    OR name LIKE auth.uid()::text || '/%'
  )
);

DROP POLICY IF EXISTS expense_receipts_insert_finance_or_owner ON storage.objects;
CREATE POLICY expense_receipts_insert_finance_or_owner ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR name LIKE auth.uid()::text || '/%'
  )
);

DROP POLICY IF EXISTS expense_receipts_update_finance ON storage.objects;
CREATE POLICY expense_receipts_update_finance ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'expense-receipts' AND public.current_user_has_any_role(ARRAY['admin','financeiro']))
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
  AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS expense_receipts_delete_finance ON storage.objects;
CREATE POLICY expense_receipts_delete_finance ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts' AND public.current_user_has_any_role(ARRAY['admin','financeiro']));

-- 4) logos: leitura pública mantida; escrita apenas admin/deposito (sem novos SVG)
DROP POLICY IF EXISTS logos_public_read ON storage.objects;
CREATE POLICY logos_public_read ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS logos_insert_admin_stock ON storage.objects;
CREATE POLICY logos_insert_admin_stock ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS logos_update_admin_stock ON storage.objects;
CREATE POLICY logos_update_admin_stock ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
)
WITH CHECK (
  bucket_id = 'logos'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS logos_delete_admin_stock ON storage.objects;
CREATE POLICY logos_delete_admin_stock ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
);

-- 5) equipment-images: leitura pública mantida; escrita apenas admin/deposito
DROP POLICY IF EXISTS equipment_images_public_read ON storage.objects;
CREATE POLICY equipment_images_public_read ON storage.objects FOR SELECT
USING (bucket_id = 'equipment-images');

DROP POLICY IF EXISTS equipment_images_insert_admin_stock ON storage.objects;
CREATE POLICY equipment_images_insert_admin_stock ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'equipment-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS equipment_images_update_admin_stock ON storage.objects;
CREATE POLICY equipment_images_update_admin_stock ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'equipment-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
)
WITH CHECK (
  bucket_id = 'equipment-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND public.storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp'])
);

DROP POLICY IF EXISTS equipment_images_delete_admin_stock ON storage.objects;
CREATE POLICY equipment_images_delete_admin_stock ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'equipment-images'
  AND public.current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR public.is_current_user_admin())
);