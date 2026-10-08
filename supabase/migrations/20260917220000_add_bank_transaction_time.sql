ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS transaction_time TIME WITHOUT TIME ZONE;

COMMENT ON COLUMN public.bank_transactions.transaction_time IS
  'Horário informado pela instituição financeira para a transação.';
