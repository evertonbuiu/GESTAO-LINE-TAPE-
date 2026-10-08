-- Adicionar coluna para comprovante de pagamento nos pagamentos mensais
ALTER TABLE public.recurring_expense_monthly_payments
ADD COLUMN IF NOT EXISTS receipt_path TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.recurring_expense_monthly_payments.receipt_path IS 'Caminho do arquivo de comprovante de pagamento no storage';