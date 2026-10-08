-- Remove unique constraint on workers.name to allow same worker in different months
ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_name_key;