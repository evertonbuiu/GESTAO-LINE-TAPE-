-- Adicionar campo para dia de vencimento em despesas fixas
ALTER TABLE public.recurring_expenses
ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.recurring_expenses.due_day IS 'Dia do mês para vencimento da despesa fixa (1-31)';

-- Constraint para garantir que o dia está entre 1 e 31
ALTER TABLE public.recurring_expenses
ADD CONSTRAINT due_day_range CHECK (due_day >= 1 AND due_day <= 31);