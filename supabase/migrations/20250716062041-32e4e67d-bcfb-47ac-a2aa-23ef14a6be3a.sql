-- Conceder ao role financeiro todas as permissões que o admin tem, exceto configurações e gerenciamento de usuários
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'financeiro'::app_role,
  p.id,
  true,
  true
FROM public.permissions p
WHERE p.name NOT IN ('settings_access', 'user_management_view', 'user_management_edit')
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp 
  WHERE rp.role = 'financeiro'::app_role 
  AND rp.permission_id = p.id
)
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;