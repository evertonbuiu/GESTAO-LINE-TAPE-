-- Add columns to link food allowances to events or mark as "galpao" (warehouse)
ALTER TABLE public.collaborator_food_allowances
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS allowance_type TEXT DEFAULT 'galpao' CHECK (allowance_type IN ('galpao', 'evento'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_collaborator_food_allowances_event_id ON public.collaborator_food_allowances(event_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_food_allowances_allowance_date ON public.collaborator_food_allowances(allowance_date);