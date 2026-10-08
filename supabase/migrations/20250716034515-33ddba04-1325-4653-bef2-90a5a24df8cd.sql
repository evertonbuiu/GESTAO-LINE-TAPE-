-- Add expense_date column to event_expenses table
ALTER TABLE public.event_expenses 
ADD COLUMN expense_date DATE DEFAULT CURRENT_DATE;