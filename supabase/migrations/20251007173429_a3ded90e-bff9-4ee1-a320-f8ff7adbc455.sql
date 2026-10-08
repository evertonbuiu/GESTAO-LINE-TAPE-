-- Add is_finalized column to daily_rates table to track completion status
ALTER TABLE public.daily_rates 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.daily_rates.is_finalized IS 'Indica se o lançamento da diária foi finalizado/confirmado pelo usuário';