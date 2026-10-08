-- Ensure permissions exist
INSERT INTO public.permissions (name, category, description) VALUES 
('clients_view', 'Clientes', 'Visualizar lista de clientes'),
('clients_edit', 'Clientes', 'Gerenciar clientes (criar, editar, excluir)')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to roles
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'admin', p.id, true, true
FROM public.permissions p
WHERE p.name IN ('clients_view', 'clients_edit')
ON CONFLICT (role, permission_id) DO UPDATE SET
  can_view = true,
  can_edit = true;

INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'funcionario', p.id, true, false
FROM public.permissions p
WHERE p.name = 'clients_view'
ON CONFLICT (role, permission_id) DO UPDATE SET
  can_view = true,
  can_edit = false;