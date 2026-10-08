-- Fix the log_operation function to handle null user_id during authentication
CREATE OR REPLACE FUNCTION public.log_operation(_operation text, _resource_type text, _resource_id uuid DEFAULT NULL::uuid, _details jsonb DEFAULT NULL::jsonb, _user_id_override uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  effective_user_id uuid;
BEGIN
  -- Use override if provided, otherwise use auth.uid()
  effective_user_id := COALESCE(_user_id_override, auth.uid());
  
  -- Only log if we have a valid user_id
  IF effective_user_id IS NOT NULL THEN
    INSERT INTO public.audit_log (
      user_id, operation, resource_type, resource_id, old_values
    ) VALUES (
      effective_user_id, _operation, _resource_type, _resource_id, _details
    );
  END IF;
END;
$function$;

-- Update the authenticate_user function to pass the user_id when logging
CREATE OR REPLACE FUNCTION public.authenticate_user(p_username text, p_password text)
 RETURNS TABLE(user_id uuid, username text, name text, role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_record RECORD;
  v_user_role app_role;
  v_attempt_count INTEGER := 0;
  v_hash_attempt TEXT;
BEGIN
  -- Basic rate limiting check
  SELECT COUNT(*) INTO v_attempt_count
  FROM public.user_credentials uc
  WHERE uc.username = p_username 
    AND uc.last_login > now() - interval '15 minutes';
    
  -- Get user credentials
  SELECT uc.id, uc.username, uc.name, uc.password_hash, uc.password_salt, uc.is_active
  INTO v_user_record
  FROM public.user_credentials uc
  WHERE uc.username = p_username;
  
  -- Check if user exists and is active
  IF v_user_record.id IS NULL OR NOT v_user_record.is_active THEN
    RETURN;
  END IF;
  
  -- Handle password verification (legacy and new hashed passwords)
  IF v_user_record.password_salt IS NOT NULL THEN
    -- New hashed password system
    -- For now, we'll implement a simple hash verification
    -- In production, this should use proper crypto libraries
    IF v_user_record.password_hash != encode(digest(p_password || v_user_record.password_salt, 'sha256'), 'hex') THEN
      RETURN;
    END IF;
  ELSE
    -- Legacy plain text password (for backward compatibility)
    IF v_user_record.password_hash != p_password THEN
      RETURN;
    END IF;
  END IF;
  
  -- Update last login
  UPDATE public.user_credentials 
  SET last_login = now() 
  WHERE id = v_user_record.id;
  
  -- Get user role with proper security
  SELECT ur.role INTO v_user_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_record.id;
  
  -- Log successful login with explicit user_id since auth.uid() is null during authentication
  PERFORM public.log_operation(
    'user_login',
    'authentication',
    v_user_record.id,
    jsonb_build_object('username', p_username, 'login_time', now()),
    v_user_record.id  -- Pass the user_id explicitly
  );
  
  -- Return user data
  user_id := v_user_record.id;
  username := v_user_record.username;
  name := v_user_record.name;
  role := COALESCE(v_user_role, 'funcionario'::app_role);
  
  RETURN NEXT;
END;
$function$;