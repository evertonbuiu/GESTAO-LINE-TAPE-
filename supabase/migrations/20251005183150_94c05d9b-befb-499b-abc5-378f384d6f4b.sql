-- Add monthly_salary column to collaborators table
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0;