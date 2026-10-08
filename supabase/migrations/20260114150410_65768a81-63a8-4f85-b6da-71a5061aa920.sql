-- Remove WhatsApp expenses table and related objects
DROP TABLE IF EXISTS public.whatsapp_expenses CASCADE;

-- Drop the update function if it exists
DROP FUNCTION IF EXISTS public.update_whatsapp_expenses_updated_at() CASCADE;