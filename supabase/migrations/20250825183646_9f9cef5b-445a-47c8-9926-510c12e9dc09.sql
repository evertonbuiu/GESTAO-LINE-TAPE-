-- Create bank_cards table for storing credit and debit cards
CREATE TABLE public.bank_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  card_number TEXT NOT NULL, -- Last 4 digits only, masked
  card_type TEXT NOT NULL CHECK (card_type IN ('credit', 'debit')),
  bank TEXT NOT NULL,
  limit_amount DECIMAL(10,2), -- Credit limit for credit cards
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_limit DECIMAL(10,2), -- Calculated field for credit cards
  due_date INTEGER, -- Day of month (1-31)
  closing_date INTEGER, -- Day of month (1-31)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;

-- Create policies for bank_cards
CREATE POLICY "Users can view their own bank cards" 
ON public.bank_cards 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own bank cards" 
ON public.bank_cards 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own bank cards" 
ON public.bank_cards 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own bank cards" 
ON public.bank_cards 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bank_cards_updated_at
BEFORE UPDATE ON public.bank_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO public.bank_cards (name, card_number, card_type, bank, limit_amount, current_balance, available_limit, due_date, closing_date, is_active) VALUES
('Cartão Empresarial Principal', '****1234', 'credit', 'Banco do Brasil', 50000.00, 12500.00, 37500.00, 15, 10, true),
('Cartão Débito C6Bank', '****5678', 'debit', 'C6Bank', NULL, 8750.00, NULL, NULL, NULL, true);