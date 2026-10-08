-- Ensure expense-receipts bucket exists
DO $$
BEGIN
  -- Check if bucket exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'expense-receipts') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('expense-receipts', 'expense-receipts', true);
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
  DROP POLICY IF EXISTS "Service role can upload expense receipts" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

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