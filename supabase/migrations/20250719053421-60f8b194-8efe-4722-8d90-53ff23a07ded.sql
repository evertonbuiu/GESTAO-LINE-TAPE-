-- Remover a foreign key constraint que está impedindo o salvamento das preferências de tema
-- Como estamos usando autenticação customizada, não precisamos referenciar auth.users

ALTER TABLE public.user_theme_preferences 
DROP CONSTRAINT IF EXISTS fk_user;

-- Verificar se existem outras constraints relacionadas
ALTER TABLE public.user_theme_preferences 
DROP CONSTRAINT IF EXISTS user_theme_preferences_user_id_fkey;