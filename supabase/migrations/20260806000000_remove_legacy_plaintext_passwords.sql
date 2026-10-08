-- Authentication is handled exclusively by Supabase Auth. Remove legacy
-- password copies so application tables never retain reusable credentials.
UPDATE public.user_credentials
SET password_hash = 'managed-by-supabase-auth',
    password_salt = NULL
WHERE password_hash IS DISTINCT FROM 'managed-by-supabase-auth';

DROP FUNCTION IF EXISTS public.authenticate_user(text, text);
