-- Update RLS policies for event_equipment table to use correct permissions
DROP POLICY IF EXISTS "Users can view event equipment based on event permissions" ON public.event_equipment;
DROP POLICY IF EXISTS "Users can manage event equipment based on event permissions" ON public.event_equipment;

-- Create new policies with correct permissions
CREATE POLICY "Users can view event equipment"
ON public.event_equipment
FOR SELECT
USING (has_permission(auth.uid(), 'event_equipment_view', 'view'));

CREATE POLICY "Users can manage event equipment"
ON public.event_equipment
FOR ALL
USING (has_permission(auth.uid(), 'event_equipment_edit', 'edit'));