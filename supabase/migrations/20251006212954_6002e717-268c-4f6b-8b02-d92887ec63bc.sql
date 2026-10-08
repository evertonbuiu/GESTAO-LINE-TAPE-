-- Adicionar campos de duração para despesas fixas
ALTER TABLE public.recurring_expenses
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Comentários para documentação
COMMENT ON COLUMN public.recurring_expenses.start_date IS 'Data de início da despesa fixa';
COMMENT ON COLUMN public.recurring_expenses.end_date IS 'Data de término da despesa fixa (opcional - null significa indeterminado)';