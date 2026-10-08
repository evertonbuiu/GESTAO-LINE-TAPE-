-- Add is_finalized column to worker_advances table
ALTER TABLE public.worker_advances 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;

-- Add is_finalized column to event_expenses table (for notinhas)
ALTER TABLE public.event_expenses 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;

-- Add is_finalized column to worker_expense_advances table
ALTER TABLE public.worker_expense_advances 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;

-- Add comments to explain the column purpose
COMMENT ON COLUMN public.worker_advances.is_finalized IS 'Indica se o vale foi finalizado/confirmado';
COMMENT ON COLUMN public.event_expenses.is_finalized IS 'Indica se a despesa foi finalizada/confirmada';
COMMENT ON COLUMN public.worker_expense_advances.is_finalized IS 'Indica se o adiantamento para notinha foi finalizado/confirmado';