-- Drop existing policies for worker-receipts
DROP POLICY IF EXISTS "Authenticated users can upload worker-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update worker-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete worker-receipts" ON storage.objects;

-- Create new policies that allow anon role (since custom auth doesn't use Supabase Auth)
CREATE POLICY "Allow upload worker-receipts"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'worker-receipts');

CREATE POLICY "Allow update worker-receipts"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Allow delete worker-receipts"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'worker-receipts');