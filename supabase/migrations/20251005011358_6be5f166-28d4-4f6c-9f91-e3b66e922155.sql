-- Drop existing restrictive policies for worker-photos bucket
DROP POLICY IF EXISTS "Authenticated users can upload worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete worker photos" ON storage.objects;

-- Create more permissive policies for worker-photos bucket
-- Since the app uses custom authentication, we allow all operations on this bucket
CREATE POLICY "Allow all uploads to worker-photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Allow all updates to worker-photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'worker-photos');

CREATE POLICY "Allow all deletes from worker-photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'worker-photos');