-- Criar tabela para vales de diaristas
CREATE TABLE public.worker_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  is_finalized BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_advances ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow all operations for authenticated users" 
ON public.worker_advances 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_worker_advances_updated_at
BEFORE UPDATE ON public.worker_advances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();