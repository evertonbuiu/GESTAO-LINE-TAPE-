-- Remover políticas antigas do bucket expense-receipts se existirem
DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete expense receipts" ON storage.objects;

-- Criar política para permitir upload de comprovantes (INSERT)
CREATE POLICY "Allow authenticated users to upload expense receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
);

-- Criar política para permitir leitura de comprovantes (SELECT)
CREATE POLICY "Allow authenticated users to view expense receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
);

-- Criar política para permitir atualização de comprovantes (UPDATE)
CREATE POLICY "Allow authenticated users to update expense receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
)
WITH CHECK (
  bucket_id = 'expense-receipts'
);

-- Criar política para permitir exclusão de comprovantes (DELETE)
CREATE POLICY "Allow authenticated users to delete expense receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
);