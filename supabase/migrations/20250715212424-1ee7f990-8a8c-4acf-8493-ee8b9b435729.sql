-- Add payment amount and payment type fields to events table
ALTER TABLE public.events 
ADD COLUMN payment_amount NUMERIC DEFAULT 0,
ADD COLUMN payment_type TEXT DEFAULT 'total' CHECK (payment_type IN ('entrada', 'total'));