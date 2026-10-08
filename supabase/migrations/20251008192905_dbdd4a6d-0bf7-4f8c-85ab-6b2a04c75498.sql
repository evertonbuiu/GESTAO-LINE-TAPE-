-- Create whatsapp_expenses table for storing expenses received via WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Outros',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_expenses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all access to whatsapp expenses"
ON public.whatsapp_expenses
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_whatsapp_expenses_phone ON public.whatsapp_expenses(phone_number);
CREATE INDEX idx_whatsapp_expenses_date ON public.whatsapp_expenses(expense_date DESC);
CREATE INDEX idx_whatsapp_expenses_processed ON public.whatsapp_expenses(processed);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_expenses_updated_at
BEFORE UPDATE ON public.whatsapp_expenses
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_expenses_updated_at();