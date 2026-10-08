-- Create table for monthly recurring expenses
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for recurring expenses
CREATE POLICY "Admin and financeiro can manage recurring expenses" 
ON public.recurring_expenses 
FOR ALL 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR current_user_has_role('financeiro'::app_role)));

CREATE POLICY "Admin and financeiro can view recurring expenses" 
ON public.recurring_expenses 
FOR SELECT 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR current_user_has_role('financeiro'::app_role)));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recurring_expenses_updated_at
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();