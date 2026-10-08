-- Criar tabela para salvar assinaturas reutilizáveis
CREATE TABLE public.saved_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  signature_data text NOT NULL, -- Base64 da assinatura
  signature_type text NOT NULL DEFAULT 'company', -- 'company' ou 'client'
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_signature_name_per_user UNIQUE (name, created_by, signature_type)
);

-- Habilitar RLS
ALTER TABLE public.saved_signatures ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para permitir acesso às assinaturas
CREATE POLICY "Users can view all saved signatures" 
ON public.saved_signatures 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own signatures" 
ON public.saved_signatures 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own signatures" 
ON public.saved_signatures 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own signatures" 
ON public.saved_signatures 
FOR DELETE 
USING (true);

-- Criar índices para melhor performance
CREATE INDEX idx_saved_signatures_created_by ON public.saved_signatures(created_by);
CREATE INDEX idx_saved_signatures_type ON public.saved_signatures(signature_type);