CREATE TABLE IF NOT EXISTS public.event_transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vehicle_model text NOT NULL,
  vehicle_plate text,
  driver_name text,
  seats integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_transport_vehicles_event_idx
  ON public.event_transport_vehicles(event_id);

DROP TRIGGER IF EXISTS update_event_transport_vehicles_updated_at ON public.event_transport_vehicles;
CREATE TRIGGER update_event_transport_vehicles_updated_at
  BEFORE UPDATE ON public.event_transport_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_transport_vehicles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_transport_vehicles TO authenticated;
GRANT ALL ON public.event_transport_vehicles TO service_role;

DROP POLICY IF EXISTS "Authenticated users manage event transport vehicles" ON public.event_transport_vehicles;
CREATE POLICY "Authenticated users manage event transport vehicles"
  ON public.event_transport_vehicles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

