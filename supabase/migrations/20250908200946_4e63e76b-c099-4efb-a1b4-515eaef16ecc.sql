-- Criar bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Criar políticas para o bucket de imagens de produtos
CREATE POLICY "Permitir visualização pública de imagens de produtos"
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Usuários autenticados podem fazer upload de imagens de produtos"
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Usuários autenticados podem atualizar suas próprias imagens de produtos"
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Usuários autenticados podem deletar suas próprias imagens de produtos"
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);