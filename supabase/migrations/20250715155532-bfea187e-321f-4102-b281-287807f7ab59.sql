-- Insert permissions for event equipment management
INSERT INTO public.permissions (name, category, description) VALUES 
('event_equipment_view', 'Event Equipment', 'View event equipment assignments'),
('event_equipment_edit', 'Event Equipment', 'Manage event equipment assignments')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to roles
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

INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'admin'::app_role,
  p.id,
  true,
  true
FROM public.permissions p
WHERE p.name IN ('event_equipment_view', 'event_equipment_edit')
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;