-- Drop the existing check constraint
ALTER TABLE public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_reference_type_check;

-- Create new check constraint with collaborator_advance included
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_reference_type_check 
  CHECK (reference_type IN (
    'event', 
    'event_remaining', 
    'expense', 
    'recurring_expense', 
    'monthly_payment', 
    'company_fixed_expense',
    'worker_advance',
    'collaborator_advance'
  ));