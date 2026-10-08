-- Create interstate_transports table
CREATE TABLE public.interstate_transports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL,
  transport_date DATE NOT NULL,
  driver_name TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  equipment_list JSONB DEFAULT '[]'::jsonb,
  total_weight NUMERIC DEFAULT 0,
  estimated_cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.interstate_transports ENABLE ROW LEVEL SECURITY;

-- Create policies for interstate transports
CREATE POLICY "Admin full access to interstate transports" 
ON public.interstate_transports 
FOR ALL 
USING (auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role));

CREATE POLICY "Users manage interstate transports with permission" 
ON public.interstate_transports 
FOR ALL 
USING (auth.uid() IS NOT NULL AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit', 'edit')));

CREATE POLICY "Users view interstate transports with permission" 
ON public.interstate_transports 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_view', 'view')));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_interstate_transports_updated_at
BEFORE UPDATE ON public.interstate_transports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();