-- Habilitar RLS nas tabelas que têm policies mas RLS desabilitado

-- Verificar e habilitar RLS para tabela recurring_expense_payment_plans
ALTER TABLE public.recurring_expense_payment_plans ENABLE ROW LEVEL SECURITY;

-- Se houver outras tabelas com o mesmo problema, habilitar também
-- (baseado nos erros do linter, parece que há várias tabelas com este problema)