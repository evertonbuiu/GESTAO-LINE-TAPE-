-- Create RLS policies for worker-receipts bucket
CREATE POLICY "Authenticated users can upload worker-receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'worker-receipts');

CREATE POLICY "Authenticated users can update worker-receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Authenticated users can delete worker-receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Public access to worker-receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'worker-receipts');