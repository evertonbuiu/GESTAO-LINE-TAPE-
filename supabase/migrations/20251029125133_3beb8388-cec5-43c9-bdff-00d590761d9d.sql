-- Add receipt_url column to worker_expense_advances table
ALTER TABLE worker_expense_advances 
ADD COLUMN IF NOT EXISTS receipt_url text;

COMMENT ON COLUMN worker_expense_advances.receipt_url IS 'URL do comprovante de adiantamento armazenado no Supabase Storage';