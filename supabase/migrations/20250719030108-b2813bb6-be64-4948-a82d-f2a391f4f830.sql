-- Segunda migração: Inserir permissões específicas para o role deposito
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'deposito'::app_role,
  p.id,
  true,
  CASE 
    WHEN p.name IN ('equipment_edit', 'inventory_edit', 'event_equipment_edit', 'collaborators_edit', 'maintenance_edit') THEN true
    ELSE false
  END
FROM public.permissions p
WHERE p.name IN (
  'dashboard_view',
  'equipment_view', 'equipment_edit',
  'inventory_view', 'inventory_edit', 
  'event_equipment_view', 'event_equipment_edit',
  'collaborators_view', 'collaborators_edit',
  'maintenance_view', 'maintenance_edit'
)
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp 
  WHERE rp.role = 'deposito'::app_role 
  AND rp.permission_id = p.id
)
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;