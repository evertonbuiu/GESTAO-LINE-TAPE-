-- Create storage bucket for worker receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-receipts', 'worker-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for worker receipts bucket
CREATE POLICY "Anyone can view worker receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Authenticated users can upload worker receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'worker-receipts' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update worker receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'worker-receipts' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete worker receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'worker-receipts' 
  AND auth.role() = 'authenticated'
);