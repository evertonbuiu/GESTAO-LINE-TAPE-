-- Add PIX key field to collaborators table
ALTER TABLE public.collaborators 
ADD COLUMN pix_key text;