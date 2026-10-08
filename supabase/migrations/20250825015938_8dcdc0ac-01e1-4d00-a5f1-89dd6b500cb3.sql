-- Create table for event budgets
CREATE TABLE public.event_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  item TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies for budget access
CREATE POLICY "Allow all access to event budgets" 
ON public.event_budgets 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_event_budgets_updated_at
BEFORE UPDATE ON public.event_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();