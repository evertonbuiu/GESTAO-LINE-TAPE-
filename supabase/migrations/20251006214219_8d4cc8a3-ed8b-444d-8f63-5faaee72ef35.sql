-- Adicionar campo para armazenar os meses selecionados em despesas fixas
ALTER TABLE public.recurring_expenses
ADD COLUMN IF NOT EXISTS selected_months INTEGER[] DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.recurring_expenses.selected_months IS 'Array com os números dos meses selecionados (1-12) para despesas por período determinado';