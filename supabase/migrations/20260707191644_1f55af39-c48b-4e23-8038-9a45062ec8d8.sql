
-- Função one-shot para migrar user_credentials -> auth.users preservando o id
CREATE OR REPLACE FUNCTION public.migrate_user_credentials_to_auth()
RETURNS TABLE(migrated_id uuid, username text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  rec RECORD;
  synthetic_email text;
BEGIN
  FOR rec IN SELECT * FROM public.user_credentials WHERE is_active = true LOOP
    synthetic_email := lower(rec.username) || '@linetape.local';

    -- Já existe em auth.users com este id? pula
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = rec.id) THEN
      migrated_id := rec.id;
      username := rec.username;
      status := 'already_exists';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Já existe com este email? pula
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = synthetic_email) THEN
      migrated_id := rec.id;
      username := rec.username;
      status := 'email_conflict';
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_super_admin, is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      rec.id,
      'authenticated',
      'authenticated',
      synthetic_email,
      extensions.crypt(rec.password_hash, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('name', rec.name, 'username', rec.username),
      now(),
      now(),
      false,
      false,
      false
    );

    -- Identidade correspondente (necessária pro login funcionar)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      rec.id,
      jsonb_build_object('sub', rec.id::text, 'email', synthetic_email, 'email_verified', true),
      'email',
      rec.id::text,
      now(),
      now(),
      now()
    );

    migrated_id := rec.id;
    username := rec.username;
    status := 'migrated';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Executa a migração
SELECT * FROM public.migrate_user_credentials_to_auth();

-- Remove a função após uso
DROP FUNCTION public.migrate_user_credentials_to_auth();
