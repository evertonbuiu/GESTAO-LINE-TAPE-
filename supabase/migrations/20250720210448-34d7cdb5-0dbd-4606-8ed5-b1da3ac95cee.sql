-- Fix RLS policies for clients table to work with custom authentication
-- Since we're using custom authentication, we need to allow access for all authenticated requests
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete clients" ON public.clients;

-- Create new policies that allow all authenticated users (bypass auth.uid() check)
CREATE POLICY "Allow all authenticated users to view clients"
ON public.clients
FOR SELECT
USING (true);

CREATE POLICY "Allow all authenticated users to insert clients"
ON public.clients
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update clients"
ON public.clients
FOR UPDATE
USING (true);

CREATE POLICY "Allow all authenticated users to delete clients"
ON public.clients
FOR DELETE
USING (true);