-- Create clients table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (only if not already enabled)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policies for clients (drop first in case they exist)
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients" ON public.clients;

CREATE POLICY "Users can view all clients"
ON public.clients
FOR SELECT
USING (has_permission(auth.uid(), 'clients_view', 'view'));

CREATE POLICY "Users can manage clients"
ON public.clients
FOR ALL
USING (has_permission(auth.uid(), 'clients_edit', 'edit'));

-- Create trigger for automatic timestamp updates (only if not exists)
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();