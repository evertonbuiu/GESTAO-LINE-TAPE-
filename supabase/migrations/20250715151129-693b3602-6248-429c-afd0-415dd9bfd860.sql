-- Create a default admin user
-- Note: This is for initial setup only. In production, you should create admin users through the proper signup process.

-- Insert a test admin user (you'll need to create this user through Supabase Auth first)
-- This is just to set up the role for the first admin user
-- The actual user creation should be done through the auth signup process

-- Create a function to promote a user to admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS VOID AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get user ID from email
    SELECT id INTO user_id FROM auth.users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Remove existing roles
    DELETE FROM public.user_roles WHERE user_id = user_id;
    
    -- Add admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;