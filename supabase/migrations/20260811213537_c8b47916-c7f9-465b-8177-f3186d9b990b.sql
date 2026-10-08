ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS import_fingerprint text;

COMMENT ON COLUMN public.bank_transactions.import_fingerprint IS
  'Fingerprint deterministico da importacao de extrato: conta + FITID + data + tipo + centavos + descricao normalizada. Nulo para lancamentos nao importados.';

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_import_fingerprint_uidx
  ON public.bank_transactions (import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;