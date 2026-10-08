ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS pluggy_item_id text,
  ADD COLUMN IF NOT EXISTS pluggy_account_id text;

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_pluggy_account_uidx
  ON public.bank_accounts (pluggy_account_id) WHERE pluggy_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_pluggy_transaction_uidx
  ON public.bank_transactions (pluggy_transaction_id) WHERE pluggy_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.bank_accounts.pluggy_item_id IS 'Identificador da conexão Pluggy; nunca contém credenciais bancárias.';
