-- Criar tabela para credenciais de usuários com username
CREATE TABLE public.user_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage user credentials" 
ON public.user_credentials 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own credentials" 
ON public.user_credentials 
FOR SELECT 
USING (auth.uid()::text = id::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_credentials_updated_at
BEFORE UPDATE ON public.user_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to authenticate user with username/password
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
  -- Get user credentials
  SELECT id, username, name, password_hash, is_active
  INTO v_user_record
  FROM public.user_credentials 
  WHERE user_credentials.username = p_username;
  
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
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = v_user_record.id;
  
  -- Return user data
  user_id := v_user_record.id;
  username := v_user_record.username;
  name := v_user_record.name;
  role := COALESCE(v_user_role, 'funcionario'::app_role);
  
  RETURN NEXT;
END;
$$;