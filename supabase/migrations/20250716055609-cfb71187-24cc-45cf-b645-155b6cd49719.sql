-- Inserir permissões específicas para área financeira
INSERT INTO public.permissions (name, category, description) VALUES 
('financial_view', 'Financeiro', 'Visualizar informações financeiras'),
('financial_edit', 'Financeiro', 'Gerenciar informações financeiras'),
('bank_accounts_view', 'Financeiro', 'Visualizar contas bancárias'),
('bank_accounts_edit', 'Financeiro', 'Gerenciar contas bancárias'),
('bank_transactions_view', 'Financeiro', 'Visualizar transações bancárias'),
('bank_transactions_edit', 'Financeiro', 'Gerenciar transações bancárias'),
('event_expenses_view', 'Financeiro', 'Visualizar despesas de eventos'),
('event_expenses_edit', 'Financeiro', 'Gerenciar despesas de eventos')
ON CONFLICT (name) DO NOTHING;

-- Conceder permissões ao role financeiro
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'financeiro'::app_role,
  p.id,
  true,
  true
FROM public.permissions p
WHERE p.category = 'Financeiro'
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;

-- Conceder acesso de visualização a eventos e equipamentos para o financeiro
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'financeiro'::app_role,
  p.id,
  true,
  false
FROM public.permissions p
WHERE p.name IN ('rentals_view', 'inventory_view', 'clients_view')
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view;

-- Conceder permissões completas ao admin (incluindo as novas financeiras)
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 
  'admin'::app_role,
  p.id,
  true,
  true
FROM public.permissions p
WHERE p.category = 'Financeiro'
ON CONFLICT (role, permission_id) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;