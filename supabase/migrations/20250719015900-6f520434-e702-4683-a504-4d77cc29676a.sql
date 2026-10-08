-- Dar permissões de event equipment para funcionários
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'funcionario'::app_role,
  p.id,
  true,
  true
FROM public.permissions p
WHERE p.name IN ('event_equipment_view', 'event_equipment_edit')
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;