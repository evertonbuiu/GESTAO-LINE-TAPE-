-- Create worker_expense_advances table for tracking money given to workers for expenses
CREATE TABLE IF NOT EXISTS public.worker_expense_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_expense_advances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all access to worker expense advances"
  ON public.worker_expense_advances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_worker_expense_advances_updated_at
  BEFORE UPDATE ON public.worker_expense_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_worker_expense_advances_worker_name 
  ON public.worker_expense_advances(worker_name);
CREATE INDEX idx_worker_expense_advances_date 
  ON public.worker_expense_advances(advance_date);