-- Add additional fields to whatsapp_expenses for complete expense tracking
ALTER TABLE public.whatsapp_expenses
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS receipt_url text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS location_type text DEFAULT 'galpao' CHECK (location_type IN ('evento', 'galpao'));