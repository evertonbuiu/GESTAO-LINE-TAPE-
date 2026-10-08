-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policies for clients
CREATE POLICY "Users can view all clients"
ON public.clients
FOR SELECT
USING (has_permission(auth.uid(), 'clients_view', 'view'));

CREATE POLICY "Users can manage clients"
ON public.clients
FOR ALL
USING (has_permission(auth.uid(), 'clients_edit', 'edit'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert permissions for clients
INSERT INTO public.permissions (name, category, description) VALUES 
('clients_view', 'Clientes', 'Visualizar lista de clientes'),
('clients_edit', 'Clientes', 'Gerenciar clientes (criar, editar, excluir)');

-- Grant permissions to roles
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'admin', p.id, true, true
FROM public.permissions p
WHERE p.name IN ('clients_view', 'clients_edit');

INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'funcionario', p.id, true, false
FROM public.permissions p
WHERE p.name IN ('clients_view', 'clients_edit');