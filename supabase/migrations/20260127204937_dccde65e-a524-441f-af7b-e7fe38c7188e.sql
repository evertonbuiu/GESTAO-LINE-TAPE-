
-- Corrigir lançamento existente: adicionar a despesa no evento "fundo do mar"
INSERT INTO event_expenses (
  event_id,
  description,
  total_price,
  unit_price,
  quantity,
  category,
  expense_date,
  expense_bank_account,
  reference_type,
  reference_id
)
SELECT 
  'f612015c-15e2-49f9-bd38-89bbe83a5461' as event_id,
  'Adiantamento Despesa: ARTUR HENRIQUE' as description,
  604.11 as total_price,
  604.11 as unit_price,
  1 as quantity,
  'Adiantamento Despesa Colaborador' as category,
  '2026-01-01'::date as expense_date,
  ba.name as expense_bank_account,
  'collaborator_expense_advance' as reference_type,
  'fed7dbf4-bbdd-4537-b22c-aa5c5c5a88c3'::uuid as reference_id
FROM bank_accounts ba
WHERE ba.id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71';

-- Atualizar a transação bancária existente para referenciar a nova despesa
-- (será feito após a criação da despesa)
