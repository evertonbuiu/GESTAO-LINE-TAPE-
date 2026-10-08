-- Drop existing policies for worker-receipts
DROP POLICY IF EXISTS "Authenticated users can upload worker receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update worker receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete worker receipts" ON storage.objects;

-- Create correct RLS policies for worker receipts bucket
CREATE POLICY "Authenticated users can upload worker receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'worker-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update worker receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'worker-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete worker receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'worker-receipts' 
  AND auth.uid() IS NOT NULL
);