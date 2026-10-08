-- Ajuste: o app está usando Supabase com role=anon (sem login Supabase), então permitir INSERT anônimo no bucket product-images

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "Anon users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');