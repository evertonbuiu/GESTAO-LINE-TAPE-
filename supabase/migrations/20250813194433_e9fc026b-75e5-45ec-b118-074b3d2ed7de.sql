-- Criar tabela para planejamento de pagamentos de despesas fixas
CREATE TABLE public.recurring_expense_payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  planned_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid', 'cancelled')),
  notes TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_payment_plans_recurring_expense ON public.recurring_expense_payment_plans(recurring_expense_id);
CREATE INDEX idx_payment_plans_date ON public.recurring_expense_payment_plans(planned_date);
CREATE INDEX idx_payment_plans_status ON public.recurring_expense_payment_plans(status);

-- RLS Policies
ALTER TABLE public.recurring_expense_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment plans" 
ON public.recurring_expense_payment_plans 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create payment plans" 
ON public.recurring_expense_payment_plans 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update payment plans" 
ON public.recurring_expense_payment_plans 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete payment plans" 
ON public.recurring_expense_payment_plans 
FOR DELETE 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_payment_plans_updated_at
BEFORE UPDATE ON public.recurring_expense_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();