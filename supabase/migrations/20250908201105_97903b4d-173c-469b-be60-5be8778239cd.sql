-- Verificar e criar políticas que não existem ainda para imagens de produtos

-- Política de visualização pública (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Permitir visualização pública de imagens de produtos'
  ) THEN
    CREATE POLICY "Permitir visualização pública de imagens de produtos"
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'product-images');
  END IF;
END $$;

-- Política de upload (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem fazer upload de imagens de produtos'
  ) THEN
    CREATE POLICY "Usuários autenticados podem fazer upload de imagens de produtos"
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (
      bucket_id = 'product-images' 
      AND auth.uid() IS NOT NULL
    );
  END IF;
END $$;

-- Política de atualização (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem atualizar suas próprias imagens de produtos'
  ) THEN
    CREATE POLICY "Usuários autenticados podem atualizar suas próprias imagens de produtos"
    ON storage.objects 
    FOR UPDATE 
    USING (
      bucket_id = 'product-images' 
      AND auth.uid() IS NOT NULL
    );
  END IF;
END $$;

-- Política de exclusão (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem deletar suas próprias imagens de produtos'
  ) THEN
    CREATE POLICY "Usuários autenticados podem deletar suas próprias imagens de produtos"
    ON storage.objects 
    FOR DELETE 
    USING (
      bucket_id = 'product-images' 
      AND auth.uid() IS NOT NULL
    );
  END IF;
END $$;