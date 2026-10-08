-- Remove monthly_salary column from collaborators
ALTER TABLE public.collaborators 
DROP COLUMN IF EXISTS monthly_salary;

-- Create collaborator_monthly_salaries table
CREATE TABLE IF NOT EXISTS public.collaborator_monthly_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  salary_month INTEGER NOT NULL CHECK (salary_month >= 0 AND salary_month <= 11),
  salary_year INTEGER NOT NULL,
  salary_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, salary_month, salary_year)
);

-- Enable RLS
ALTER TABLE public.collaborator_monthly_salaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all access to collaborator monthly salaries"
ON public.collaborator_monthly_salaries
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_collaborator_monthly_salaries_collaborator_month 
ON public.collaborator_monthly_salaries(collaborator_id, salary_year, salary_month);