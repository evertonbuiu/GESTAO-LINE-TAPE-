-- Temporarily allow all authenticated users to view equipment until proper role assignment is implemented
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Authorized users can manage equipment" ON public.equipment;

-- Create more permissive policies
CREATE POLICY "Users can view equipment"
ON public.equipment
FOR SELECT
USING (has_permission(auth.uid(), 'inventory_view', 'view'));

CREATE POLICY "Users can manage equipment"
ON public.equipment
FOR ALL
USING (has_permission(auth.uid(), 'inventory_edit', 'edit'));