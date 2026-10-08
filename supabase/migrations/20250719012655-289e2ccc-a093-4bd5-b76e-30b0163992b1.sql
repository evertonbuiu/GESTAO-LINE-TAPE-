-- Add quantity field to maintenance_records table
ALTER TABLE public.maintenance_records 
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.maintenance_records.quantity IS 'Number of equipment units under maintenance';