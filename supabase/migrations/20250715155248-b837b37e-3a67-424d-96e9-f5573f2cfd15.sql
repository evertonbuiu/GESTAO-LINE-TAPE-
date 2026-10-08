-- Create event_equipment table for tracking equipment assigned to events
CREATE TABLE public.event_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  equipment_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  description text,
  status text NOT NULL DEFAULT 'pending',
  assigned_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.event_equipment ENABLE ROW LEVEL SECURITY;

-- Create policies for event_equipment
CREATE POLICY "Users can view event equipment based on event permissions"
ON public.event_equipment
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_equipment.event_id
    AND has_permission(auth.uid(), 'rentals_view', 'view')
  )
);

CREATE POLICY "Users can manage event equipment based on event permissions"
ON public.event_equipment
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_equipment.event_id
    AND has_permission(auth.uid(), 'rentals_edit', 'edit')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_event_equipment_updated_at
BEFORE UPDATE ON public.event_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();