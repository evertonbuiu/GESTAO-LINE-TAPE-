-- Add pdf_url column to event_budgets table
ALTER TABLE public.event_budgets 
ADD COLUMN pdf_url TEXT;