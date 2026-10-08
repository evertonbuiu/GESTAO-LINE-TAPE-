-- Drop existing policies for receipts bucket
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;

-- Allow public read access to receipts
CREATE POLICY "Public can view receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to update receipts
CREATE POLICY "Authenticated users can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to delete receipts
CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');