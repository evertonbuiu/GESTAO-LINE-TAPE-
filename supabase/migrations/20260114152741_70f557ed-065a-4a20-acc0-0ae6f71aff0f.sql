-- Criar bucket para imagens de produtos de orçamento se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-product-images', 'quote-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Anyone can view quote product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quote product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update quote product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quote product images" ON storage.objects;

-- Política para visualização pública
CREATE POLICY "Anyone can view quote product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'quote-product-images');

-- Política para upload por usuários autenticados
CREATE POLICY "Authenticated users can upload quote product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'quote-product-images' AND auth.role() = 'authenticated');

-- Política para atualização por usuários autenticados
CREATE POLICY "Authenticated users can update quote product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'quote-product-images' AND auth.role() = 'authenticated');

-- Política para exclusão por usuários autenticados
CREATE POLICY "Authenticated users can delete quote product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'quote-product-images' AND auth.role() = 'authenticated');