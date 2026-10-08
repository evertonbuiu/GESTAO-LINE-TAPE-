-- Update equipment policies to allow proper CRUD operations
DROP POLICY IF EXISTS "Users can manage equipment" ON public.equipment;

-- Create separate policies for better control
CREATE POLICY "Users can insert equipment"
ON public.equipment
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'inventory_edit', 'edit'));

CREATE POLICY "Users can update equipment"
ON public.equipment
FOR UPDATE
USING (has_permission(auth.uid(), 'inventory_edit', 'edit'));

CREATE POLICY "Users can delete equipment"
ON public.equipment
FOR DELETE
USING (has_permission(auth.uid(), 'inventory_edit', 'edit'));