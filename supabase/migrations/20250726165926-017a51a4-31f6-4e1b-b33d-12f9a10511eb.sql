-- Adicionar colunas para lista de materiais e estado de retorno
ALTER TABLE public.interstate_transports 
ADD COLUMN IF NOT EXISTS material_list jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS return_date date,
ADD COLUMN IF NOT EXISTS return_notes text;