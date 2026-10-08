-- Create storage policies for 'logos' bucket to allow uploads and deletions (public access)
-- These policies are necessary because the app uses custom auth (no auth.uid()),
-- so we allow operations scoped strictly to the 'logos' bucket.

DO $$
BEGIN
  -- Public read (SELECT) for logos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read logos'
  ) THEN
    CREATE POLICY "Public read logos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'logos');
  END IF;

  -- Public upload (INSERT) for logos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public upload logos'
  ) THEN
    CREATE POLICY "Public upload logos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'logos');
  END IF;

  -- Public delete (DELETE) for logos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public delete logos'
  ) THEN
    CREATE POLICY "Public delete logos"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'logos');
  END IF;

  -- Optional: allow update (e.g., metadata updates) within the logos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public update logos'
  ) THEN
    CREATE POLICY "Public update logos"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'logos')
    WITH CHECK (bucket_id = 'logos');
  END IF;
END
$$;