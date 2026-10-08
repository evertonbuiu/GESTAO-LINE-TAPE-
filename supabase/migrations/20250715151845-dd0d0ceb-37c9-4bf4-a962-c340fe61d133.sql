-- Fix the promote_user_to_admin function
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS VOID AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get user ID from email
    SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Remove existing roles for this user
    DELETE FROM public.user_roles WHERE user_roles.user_id = target_user_id;
    
    -- Add admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin');
    
    RAISE NOTICE 'User % promoted to admin successfully', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;