-- Deletar as 55 transações importadas do statement_import na conta C6
DELETE FROM public.bank_transactions 
WHERE bank_account_id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71' 
AND reference_type = 'statement_import';

-- Recalcular o saldo da conta C6 baseado nas transações restantes
UPDATE public.bank_accounts 
SET 
  balance = (
    SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
    FROM public.bank_transactions
    WHERE bank_account_id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71'
  ),
  current_balance = (
    SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
    FROM public.bank_transactions
    WHERE bank_account_id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71'
  ),
  updated_at = now()
WHERE id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71';