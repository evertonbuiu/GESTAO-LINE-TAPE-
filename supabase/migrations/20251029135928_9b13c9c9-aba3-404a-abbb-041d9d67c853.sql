-- Add worker_expense_advance and collaborator_expense_advance to allowed reference types
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
  'worker_vale',
  'collaborator_vale',
  'worker_expense_advance',
  'collaborator_expense_advance'
));