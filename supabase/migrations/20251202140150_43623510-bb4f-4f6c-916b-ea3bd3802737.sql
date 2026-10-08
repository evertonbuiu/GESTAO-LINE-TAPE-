-- Criar tabela para dados bancários salvos
CREATE TABLE public.saved_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_holder TEXT,
  account_number TEXT,
  account_agency TEXT,
  account_document TEXT,
  pix_key TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.saved_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Política de acesso total
CREATE POLICY "Allow all access to saved bank accounts"
ON public.saved_bank_accounts
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_saved_bank_accounts_updated_at
BEFORE UPDATE ON public.saved_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();