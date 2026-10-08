-- Create external quotes table for LINE TAPE system
CREATE TABLE public.external_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  event_date DATE,
  event_location TEXT,
  decorator_name TEXT,
  
  -- Products and pricing
  products JSONB DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  travel_expense DECIMAL(10,2) DEFAULT 0,
  accommodation_expense DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Tax options
  tax_option TEXT DEFAULT 'sem_nota' CHECK (tax_option IN ('sem_nota', 'isento', 'com_nota')),
  
  -- Status and metadata
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view external quotes" 
ON public.external_quotes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create external quotes" 
ON public.external_quotes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update external quotes" 
ON public.external_quotes 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete external quotes" 
ON public.external_quotes 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_external_quotes_updated_at
BEFORE UPDATE ON public.external_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();