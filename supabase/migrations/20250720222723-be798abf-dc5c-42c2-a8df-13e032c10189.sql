-- Criar políticas mais permissivas para user_credentials e user_roles
-- já que o sistema usa autenticação customizada

-- Remover políticas restritivas das tabelas user_credentials
DROP POLICY IF EXISTS "Admins can manage user credentials" ON public.user_credentials;
DROP POLICY IF EXISTS "Users can view their own credentials" ON public.user_credentials;

-- Remover políticas restritivas das tabelas user_roles  
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Criar políticas permissivas para permitir acesso público
-- (já que a autenticação é gerenciada pela aplicação)
CREATE POLICY "Allow public access to user_credentials" ON public.user_credentials
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to user_roles" ON public.user_roles
  FOR ALL USING (true) WITH CHECK (true);