-- First, update existing events to use valid user_credentials IDs
UPDATE public.events 
SET created_by = (SELECT id FROM public.user_credentials LIMIT 1)
WHERE created_by NOT IN (SELECT id FROM public.user_credentials);

-- Update existing event_expenses to use valid user_credentials IDs
UPDATE public.event_expenses 
SET created_by = (SELECT id FROM public.user_credentials LIMIT 1)
WHERE created_by NOT IN (SELECT id FROM public.user_credentials);

-- Now remove the old foreign key constraints
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE public.event_expenses DROP CONSTRAINT IF EXISTS event_expenses_created_by_fkey;

-- Add new foreign key constraints pointing to user_credentials instead of auth.users
ALTER TABLE public.events 
ADD CONSTRAINT events_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.user_credentials(id);

ALTER TABLE public.event_expenses 
ADD CONSTRAINT event_expenses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.user_credentials(id);