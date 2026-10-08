-- Add missing columns to interstate_transports table
ALTER TABLE public.interstate_transports 
ADD COLUMN IF NOT EXISTS origin_state TEXT,
ADD COLUMN IF NOT EXISTS driver_cpf TEXT,
ADD COLUMN IF NOT EXISTS cargo_type TEXT,
ADD COLUMN IF NOT EXISTS cargo_weight NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cargo_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;