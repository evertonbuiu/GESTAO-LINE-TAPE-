-- Add setup start date column to events table
ALTER TABLE public.events 
ADD COLUMN setup_start_date date;