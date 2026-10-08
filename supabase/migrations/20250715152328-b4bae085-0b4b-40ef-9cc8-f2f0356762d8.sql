-- Create permissions table for role-based access control
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role_permissions table to assign permissions to roles
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions (only admins can manage)
CREATE POLICY "Admins can view all permissions"
ON public.permissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage permissions"
ON public.permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for role_permissions (only admins can manage)
CREATE POLICY "Admins can view all role permissions"
ON public.role_permissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default permissions
INSERT INTO public.permissions (name, description, category) VALUES
('dashboard_revenue', 'Ver receita no dashboard', 'Dashboard'),
('equipment_view', 'Visualizar equipamentos', 'Equipamentos'),
('equipment_edit', 'Editar equipamentos', 'Equipamentos'),
('equipment_delete', 'Excluir equipamentos', 'Equipamentos'),
('inventory_view', 'Visualizar estoque', 'Estoque'),
('inventory_edit', 'Editar estoque', 'Estoque'),
('rentals_view', 'Visualizar locações', 'Locações'),
('rentals_edit', 'Editar locações', 'Locações'),
('rentals_delete', 'Excluir locações', 'Locações'),
('clients_view', 'Visualizar clientes', 'Clientes'),
('clients_edit', 'Editar clientes', 'Clientes'),
('clients_delete', 'Excluir clientes', 'Clientes'),
('maintenance_view', 'Visualizar manutenção', 'Manutenção'),
('maintenance_edit', 'Editar manutenção', 'Manutenção'),
('settings_access', 'Acessar configurações', 'Sistema');

-- Insert default role permissions for funcionario (view only for most things)
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'funcionario',
  p.id,
  CASE 
    WHEN p.name IN ('dashboard_revenue', 'settings_access') THEN false
    ELSE true
  END as can_view,
  CASE 
    WHEN p.name IN ('equipment_delete', 'rentals_delete', 'clients_delete', 'dashboard_revenue', 'settings_access') THEN false
    ELSE true
  END as can_edit
FROM public.permissions p;

-- Insert admin permissions (full access to everything)
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'admin',
  p.id,
  true,
  true
FROM public.permissions p;

-- Function to check specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT, _access_type TEXT DEFAULT 'view')
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT 
      CASE 
        WHEN _access_type = 'edit' THEN rp.can_edit
        ELSE rp.can_view
      END
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id AND p.name = _permission_name),
    false
  )
$$;

-- Trigger for automatic timestamp updates on role_permissions
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();