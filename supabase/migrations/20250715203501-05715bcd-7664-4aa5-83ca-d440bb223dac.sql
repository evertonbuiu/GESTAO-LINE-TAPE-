-- Adicionar campos de banco nas tabelas de eventos e despesas

-- Adicionar campo de banco para eventos (quando status for pago)
ALTER TABLE public.events 
ADD COLUMN payment_bank_account TEXT;

-- Adicionar campo de banco para despesas (de qual banco saiu o dinheiro)
ALTER TABLE public.event_expenses 
ADD COLUMN expense_bank_account TEXT;

-- Criar tabela de contas bancárias para controle
CREATE TABLE public.bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'cash')),
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir algumas contas bancárias padrão
INSERT INTO public.bank_accounts (name, account_type, balance) VALUES
('Conta Corrente Principal', 'checking', 25000.00),
('Conta Poupança', 'savings', 15000.00),
('Dinheiro em Caixa', 'cash', 2500.00);

-- Habilitar RLS na tabela de contas bancárias
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para contas bancárias
CREATE POLICY "Users can view bank accounts" 
ON public.bank_accounts 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage bank accounts" 
ON public.bank_accounts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Criar função para atualizar updated_at
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();