-- Desabilitar RLS nas tabelas de usuários para permitir acesso do admin
ALTER TABLE public.user_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;