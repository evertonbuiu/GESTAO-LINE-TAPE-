-- Remover políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "Permitir visualização pública de imagens de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de imagens de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas próprias imagens de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas próprias imagens de produtos" ON storage.objects;

-- Criar políticas mais permissivas para o bucket product-images
CREATE POLICY "Public access to product images"
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Allow all authenticated users to upload product images"
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow all authenticated users to update product images"
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images');

CREATE POLICY "Allow all authenticated users to delete product images"
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images');