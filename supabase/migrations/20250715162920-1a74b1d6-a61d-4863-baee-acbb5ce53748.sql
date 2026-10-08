-- Enable realtime for equipment table
ALTER TABLE public.equipment REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;

-- Enable realtime for event_equipment table
ALTER TABLE public.event_equipment REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_equipment;