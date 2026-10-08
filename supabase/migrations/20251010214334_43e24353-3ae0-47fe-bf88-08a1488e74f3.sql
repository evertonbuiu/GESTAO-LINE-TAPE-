-- Create storage bucket for expense receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload expense receipts" ON storage.objects;

-- Create RLS policies for expense-receipts bucket
CREATE POLICY "Anyone can view expense receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-receipts');

CREATE POLICY "Authenticated users can upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-receipts');

CREATE POLICY "Service role can upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-receipts');