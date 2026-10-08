-- Drop existing policies for worker-receipts bucket
DROP POLICY IF EXISTS "Anyone can view worker receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload worker receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update worker receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete worker receipts" ON storage.objects;

-- Create storage bucket for worker receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-receipts', 'worker-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create simple RLS policies that allow all operations
-- Since the system uses custom authentication, we allow operations without auth.uid()
CREATE POLICY "Anyone can view worker receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Allow uploads to worker receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worker-receipts');

CREATE POLICY "Allow updates to worker receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'worker-receipts');

CREATE POLICY "Allow deletes from worker receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'worker-receipts');