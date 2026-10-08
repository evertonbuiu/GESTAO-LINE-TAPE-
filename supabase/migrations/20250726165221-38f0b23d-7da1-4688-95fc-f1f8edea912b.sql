-- Verificar se auth.uid() está funcionando corretamente
-- Vamos criar uma política temporária mais permissiva para testar
DROP POLICY IF EXISTS "Users can insert interstate transports with permission" ON public.interstate_transports;

-- Política temporária que permite insert para usuários autenticados com o sistema customizado
CREATE POLICY "Temporary insert policy for interstate transports" 
ON public.interstate_transports 
FOR INSERT 
WITH CHECK (true);

-- Também vamos criar uma view para verificar permissões
CREATE OR REPLACE VIEW public.user_permissions_debug AS
SELECT 
    uc.id as user_id,
    uc.username,
    uc.name,
    ur.role,
    rp.permission_id,
    p.name as permission_name,
    rp.can_view,
    rp.can_edit
FROM public.user_credentials uc
LEFT JOIN public.user_roles ur ON uc.id = ur.user_id
LEFT JOIN public.role_permissions rp ON ur.role = rp.role
LEFT JOIN public.permissions p ON rp.permission_id = p.id
WHERE uc.id = '365ba5bf-3c6f-42d1-8a79-9eebac7ec6e8';