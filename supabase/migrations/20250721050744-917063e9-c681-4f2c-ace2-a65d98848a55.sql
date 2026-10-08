-- Tornar o campo created_by opcional
ALTER TABLE public.patrimony_inventory 
ALTER COLUMN created_by DROP NOT NULL;