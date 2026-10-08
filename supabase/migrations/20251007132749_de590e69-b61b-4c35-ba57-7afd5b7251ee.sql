-- Remover todas as políticas do bucket expense-receipts
DROP POLICY IF EXISTS "Allow authenticated users to upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete expense receipts" ON storage.objects;

-- Criar políticas que permitem acesso público ao bucket expense-receipts
-- Permitir qualquer um fazer upload
CREATE POLICY "Allow public upload to expense-receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'expense-receipts');

-- Permitir qualquer um visualizar
CREATE POLICY "Allow public select from expense-receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'expense-receipts');

-- Permitir qualquer um atualizar
CREATE POLICY "Allow public update to expense-receipts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'expense-receipts')
WITH CHECK (bucket_id = 'expense-receipts');

-- Permitir qualquer um deletar
CREATE POLICY "Allow public delete from expense-receipts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'expense-receipts');