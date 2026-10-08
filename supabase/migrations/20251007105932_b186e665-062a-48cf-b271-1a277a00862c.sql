-- Criar bucket para comprovantes de despesas fixas
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Adicionar coluna para armazenar o caminho do comprovante
ALTER TABLE public.recurring_expenses
ADD COLUMN IF NOT EXISTS receipt_path TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.recurring_expenses.receipt_path IS 'Caminho do arquivo de comprovante no storage';

-- RLS policies para o bucket de comprovantes
CREATE POLICY "Usuários autenticados podem fazer upload de comprovantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense-receipts');

CREATE POLICY "Usuários autenticados podem visualizar comprovantes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expense-receipts');

CREATE POLICY "Usuários autenticados podem atualizar seus comprovantes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'expense-receipts');

CREATE POLICY "Usuários autenticados podem deletar comprovantes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expense-receipts');