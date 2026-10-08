-- Create workers table to store worker information including photo
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Create policy for workers
CREATE POLICY "Allow all access to workers"
  ON public.workers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for worker photos
CREATE POLICY "Anyone can view worker photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'worker-photos');

CREATE POLICY "Authenticated users can upload worker photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'worker-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update worker photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'worker-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete worker photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'worker-photos' AND auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();