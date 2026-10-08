-- Adicionar campo para ano selecionado em despesas fixas por período
ALTER TABLE public.recurring_expenses
ADD COLUMN IF NOT EXISTS selected_year INTEGER DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.recurring_expenses.selected_year IS 'Ano selecionado para despesas fixas por período determinado';