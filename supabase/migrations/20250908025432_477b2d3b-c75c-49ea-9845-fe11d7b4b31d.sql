-- Criar tabela de contratos
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_document TEXT,
  service_description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  payment_terms TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de anexos de contratos
CREATE TABLE public.contract_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pagamentos de contratos
CREATE TABLE public.contract_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;

-- Criar políticas para contratos
CREATE POLICY "Users can view all contracts" 
ON public.contracts 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admins and financeiro can manage contracts" 
ON public.contracts 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'financeiro')
  )
);

-- Criar políticas para anexos
CREATE POLICY "Users can view contract attachments" 
ON public.contract_attachments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admins and financeiro can manage attachments" 
ON public.contract_attachments 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'financeiro')
  )
);

-- Criar políticas para pagamentos
CREATE POLICY "Users can view contract payments" 
ON public.contract_payments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admins and financeiro can manage payments" 
ON public.contract_payments 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'financeiro')
  )
);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_payments_updated_at
BEFORE UPDATE ON public.contract_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_contracts_client_name ON public.contracts(client_name);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_start_date ON public.contracts(start_date);
CREATE INDEX idx_contract_payments_contract_id ON public.contract_payments(contract_id);
CREATE INDEX idx_contract_attachments_contract_id ON public.contract_attachments(contract_id);