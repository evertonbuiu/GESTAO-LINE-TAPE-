-- Inserir usuário administrador padrão para primeiro acesso
INSERT INTO public.user_credentials (username, password_hash, name, is_active)
VALUES ('admin', gen_random_uuid()::text || gen_random_uuid()::text, 'Administrador', true)
ON CONFLICT (username) DO NOTHING;

-- Criar role de administrador para o usuário padrão
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.user_credentials 
WHERE username = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;
