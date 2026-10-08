-- Create table for monthly payments of recurring expenses
CREATE TABLE public.recurring_expense_monthly_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_expense_id UUID NOT NULL,
  payment_month INTEGER NOT NULL CHECK (payment_month >= 1 AND payment_month <= 12),
  payment_year INTEGER NOT NULL CHECK (payment_year >= 2020),
  payment_date DATE NOT NULL,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  bank_account_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(recurring_expense_id, payment_month, payment_year)
);

-- Enable RLS
ALTER TABLE public.recurring_expense_monthly_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for monthly payments
CREATE POLICY "Users can view monthly payments" 
ON public.recurring_expense_monthly_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create monthly payments" 
ON public.recurring_expense_monthly_payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update monthly payments" 
ON public.recurring_expense_monthly_payments 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete monthly payments" 
ON public.recurring_expense_monthly_payments 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_recurring_expense_monthly_payments_updated_at
BEFORE UPDATE ON public.recurring_expense_monthly_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();