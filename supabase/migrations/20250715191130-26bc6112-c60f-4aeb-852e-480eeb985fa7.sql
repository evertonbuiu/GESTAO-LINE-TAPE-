-- Create event_collaborators table for tracking collaborators assigned to events
CREATE TABLE public.event_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  collaborator_name text NOT NULL,
  collaborator_email text NOT NULL,
  role text NOT NULL DEFAULT 'funcionario',
  assigned_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Create policies for event_collaborators
CREATE POLICY "Users can view event collaborators based on event permissions"
ON public.event_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_collaborators.event_id
    AND has_permission(auth.uid(), 'rentals_view', 'view')
  )
);

CREATE POLICY "Users can manage event collaborators based on event permissions"
ON public.event_collaborators
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_collaborators.event_id
    AND has_permission(auth.uid(), 'rentals_edit', 'edit')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_event_collaborators_updated_at
BEFORE UPDATE ON public.event_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();