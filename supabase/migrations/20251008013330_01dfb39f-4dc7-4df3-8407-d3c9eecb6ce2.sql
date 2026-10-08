-- Adicionar 'statement_import' aos tipos permitidos de reference_type em bank_transactions
ALTER TABLE public.bank_transactions 
DROP CONSTRAINT IF EXISTS bank_transactions_reference_type_check;

ALTER TABLE public.bank_transactions 
ADD CONSTRAINT bank_transactions_reference_type_check 
CHECK (reference_type IN (
  'event', 
  'event_remaining', 
  'expense', 
  'recurring_expense', 
  'monthly_payment', 
  'company_fixed_expense',
  'worker_advance',
  'collaborator_advance',
  'statement_import'
));