-- Enable realtime for whatsapp_expenses table
ALTER TABLE public.whatsapp_expenses REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_expenses;