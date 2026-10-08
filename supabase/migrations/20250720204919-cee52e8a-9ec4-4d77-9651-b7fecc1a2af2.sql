-- Fix RLS policies for clients table
DROP POLICY IF EXISTS "Anyone authenticated can view clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone authenticated can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone authenticated can update clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone authenticated can delete clients" ON public.clients;

-- Create new simplified policies that allow any authenticated user to manage clients
CREATE POLICY "Users can view all clients"
ON public.clients
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert clients"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update clients"
ON public.clients
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete clients"
ON public.clients
FOR DELETE
USING (auth.uid() IS NOT NULL);