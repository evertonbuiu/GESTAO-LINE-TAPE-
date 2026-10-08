-- Update bank_transactions reference_type constraint to include worker_advance
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
  'worker_advance'
));