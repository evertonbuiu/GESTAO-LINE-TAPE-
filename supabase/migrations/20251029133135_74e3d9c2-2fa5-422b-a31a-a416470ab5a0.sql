-- Remover todas as políticas RLS antigas de worker_expense_advances
DROP POLICY IF EXISTS "Enable all access for worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can view worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can insert worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can update worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can delete worker expense advances" ON worker_expense_advances;

-- Criar bucket de receipts se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de storage para o bucket receipts
-- Permitir upload para todos
CREATE POLICY "Anyone can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Permitir visualização pública
CREATE POLICY "Public access to receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Permitir atualização para todos
CREATE POLICY "Anyone can update receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts');

-- Permitir deleção para todos
CREATE POLICY "Anyone can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts');