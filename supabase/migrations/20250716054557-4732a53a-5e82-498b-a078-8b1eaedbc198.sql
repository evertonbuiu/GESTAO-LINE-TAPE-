-- Corrigir função de autenticação para resolver ambiguidade de colunas
CREATE OR REPLACE FUNCTION public.authenticate_user(
  p_username TEXT,
  p_password TEXT
) RETURNS TABLE(
  user_id UUID,
  username TEXT,
  name TEXT,
  role app_role
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_user_role app_role;
BEGIN
  -- Get user credentials - especificar tabela explicitamente
  SELECT uc.id, uc.username, uc.name, uc.password_hash, uc.is_active
  INTO v_user_record
  FROM public.user_credentials uc
  WHERE uc.username = p_username;
  
  -- Check if user exists and is active
  IF v_user_record.id IS NULL OR NOT v_user_record.is_active THEN
    RETURN;
  END IF;
  
  -- Verify password (in real implementation, use proper hashing)
  -- For now, storing plain text for simplicity
  IF v_user_record.password_hash != p_password THEN
    RETURN;
  END IF;
  
  -- Update last login
  UPDATE public.user_credentials 
  SET last_login = now() 
  WHERE id = v_user_record.id;
  
  -- Get user role
  SELECT ur.role INTO v_user_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_record.id;
  
  -- Return user data
  user_id := v_user_record.id;
  username := v_user_record.username;
  name := v_user_record.name;
  role := COALESCE(v_user_role, 'funcionario'::app_role);
  
  RETURN NEXT;
END;
$$;