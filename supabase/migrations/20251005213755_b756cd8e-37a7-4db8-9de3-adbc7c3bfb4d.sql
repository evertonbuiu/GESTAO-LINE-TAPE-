-- Adicionar campos de referência na tabela event_expenses
ALTER TABLE public.event_expenses 
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_event_expenses_reference 
ON public.event_expenses(reference_type, reference_id);