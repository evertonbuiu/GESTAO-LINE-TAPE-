-- Criar tabela para adiantamentos de notinhas de colaboradores
CREATE TABLE IF NOT EXISTS public.collaborator_expense_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.collaborator_expense_advances ENABLE ROW LEVEL SECURITY;

-- Política de acesso total
CREATE POLICY "Allow all access to collaborator expense advances"
  ON public.collaborator_expense_advances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_collaborator_expense_advances_collaborator_id 
  ON public.collaborator_expense_advances(collaborator_id);

CREATE INDEX IF NOT EXISTS idx_collaborator_expense_advances_advance_date 
  ON public.collaborator_expense_advances(advance_date);