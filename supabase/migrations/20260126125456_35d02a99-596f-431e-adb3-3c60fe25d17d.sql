-- Create a table for worker (diarista) food allowances
CREATE TABLE public.worker_food_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  allowance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  allowance_type TEXT DEFAULT 'galpao',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_food_allowances ENABLE ROW LEVEL SECURITY;

-- Create policy for access
CREATE POLICY "Allow all access to worker_food_allowances" 
ON public.worker_food_allowances 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_worker_food_allowances_updated_at
BEFORE UPDATE ON public.worker_food_allowances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();