-- Create receipts bucket for storing expense advance receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts
CREATE POLICY "Users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to view receipts
CREATE POLICY "Users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to update their own receipts
CREATE POLICY "Users can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to delete receipts
CREATE POLICY "Users can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');