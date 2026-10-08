-- Remover a constraint antiga e adicionar nova com mais valores
ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_reference_type_check;

ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_reference_type_check 
CHECK (reference_type = ANY (ARRAY['event'::text, 'event_remaining'::text, 'expense'::text, 'recurring_expense'::text, 'monthly_payment'::text, 'company_fixed_expense'::text, 'worker_advance'::text, 'collaborator_advance'::text, 'worker_vale'::text, 'collaborator_vale'::text, 'worker_expense_advance'::text, 'collaborator_expense_advance'::text, 'company_expense'::text, 'event_payment'::text, 'event_expense'::text]));

-- Inserir transações de despesas de eventos para c6bank
INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, transaction_date, reference_type, reference_id)
SELECT 
  '1cc4036f-a3cc-4422-bd9c-f6c266aee865',
  'Despesa - ' || description,
  total_price,
  'expense',
  COALESCE(category, 'Outros'),
  expense_date,
  'event_expense',
  id
FROM event_expenses 
WHERE (expense_bank_account = 'c6bank' OR expense_bank_account = '1cc4036f-a3cc-4422-bd9c-f6c266aee865')
AND expense_date IS NOT NULL
ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;

-- Inserir transações de despesas da empresa para c6bank
INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, transaction_date, reference_type, reference_id)
SELECT 
  '1cc4036f-a3cc-4422-bd9c-f6c266aee865',
  'Despesa Empresa - ' || description,
  total_price,
  'expense',
  COALESCE(category, 'Outros'),
  expense_date,
  'company_expense',
  id
FROM company_expenses 
WHERE (expense_bank_account = 'c6bank' OR expense_bank_account = '1cc4036f-a3cc-4422-bd9c-f6c266aee865')
AND expense_date IS NOT NULL
ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;

-- Inserir transações de receitas de eventos para c6bank
INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, transaction_date, reference_type, reference_id)
SELECT 
  '1cc4036f-a3cc-4422-bd9c-f6c266aee865',
  'Receita - ' || name,
  payment_amount,
  'income',
  'Receita Evento',
  payment_date,
  'event_payment',
  id
FROM events 
WHERE (payment_bank_account = 'c6bank' OR payment_bank_account = '1cc4036f-a3cc-4422-bd9c-f6c266aee865')
AND payment_amount IS NOT NULL 
AND payment_amount > 0
AND payment_date IS NOT NULL
ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;