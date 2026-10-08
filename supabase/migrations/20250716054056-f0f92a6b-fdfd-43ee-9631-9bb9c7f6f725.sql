-- Remover a constraint de foreign key existente se existir
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Inserir usuário administrador padrão para primeiro acesso
INSERT INTO public.user_credentials (username, password_hash, name, is_active)
VALUES ('admin', gen_random_uuid()::text || gen_random_uuid()::text, 'Administrador', true)
ON CONFLICT (username) DO NOTHING;

-- Criar role de administrador para o usuário padrão usando a coluna correta
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.user_credentials 
WHERE username = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = (SELECT id FROM public.user_credentials WHERE username = 'admin')
);
