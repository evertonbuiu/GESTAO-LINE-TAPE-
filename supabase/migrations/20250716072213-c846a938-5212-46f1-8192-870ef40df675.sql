-- Remove foreign key constraints from events and event_expenses tables
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE public.event_expenses DROP CONSTRAINT IF EXISTS event_expenses_created_by_fkey;

-- Add new foreign key constraints pointing to user_credentials instead of auth.users
ALTER TABLE public.events 
ADD CONSTRAINT events_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.user_credentials(id);

ALTER TABLE public.event_expenses 
ADD CONSTRAINT event_expenses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.user_credentials(id);