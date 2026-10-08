-- Create client_advances table
CREATE TABLE IF NOT EXISTS public.client_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_advances ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access
CREATE POLICY "Allow all access to client advances"
  ON public.client_advances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_client_advances_client_id ON public.client_advances(client_id);
CREATE INDEX idx_client_advances_advance_date ON public.client_advances(advance_date);

-- Create trigger to update updated_at
CREATE TRIGGER update_client_advances_updated_at
  BEFORE UPDATE ON public.client_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
