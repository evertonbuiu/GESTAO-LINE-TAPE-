-- Create a private bucket for storing digital certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('nfse-certificates', 'nfse-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the certificates bucket
CREATE POLICY "Allow authenticated users to upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nfse-certificates');

CREATE POLICY "Allow authenticated users to view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'nfse-certificates');

CREATE POLICY "Allow authenticated users to delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'nfse-certificates');

-- Also allow anon role (since the app uses custom auth)
CREATE POLICY "Allow anon to upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nfse-certificates');

CREATE POLICY "Allow anon to view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'nfse-certificates');

CREATE POLICY "Allow anon to delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'nfse-certificates');