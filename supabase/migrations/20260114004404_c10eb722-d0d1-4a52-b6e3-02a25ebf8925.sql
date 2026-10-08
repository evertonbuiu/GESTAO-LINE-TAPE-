-- Criar tabela para diárias de alimentação dos colaboradores
CREATE TABLE public.collaborator_food_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  allowance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborator_food_allowances ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for authenticated users
CREATE POLICY "Allow all operations for authenticated users" 
ON public.collaborator_food_allowances 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_collaborator_food_allowances_collaborator_id ON public.collaborator_food_allowances(collaborator_id);
CREATE INDEX idx_collaborator_food_allowances_date ON public.collaborator_food_allowances(allowance_date);

-- Create trigger for updated_at
CREATE TRIGGER update_collaborator_food_allowances_updated_at
BEFORE UPDATE ON public.collaborator_food_allowances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();