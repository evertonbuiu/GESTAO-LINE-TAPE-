-- Criar tabela para peças personalizadas fabricadas para clientes
CREATE TABLE IF NOT EXISTS public.client_custom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  fabrication_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.client_custom_items ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso completo (igual outras tabelas do sistema)
CREATE POLICY "Allow all access to client custom items"
  ON public.client_custom_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_custom_items_updated_at
  BEFORE UPDATE ON public.client_custom_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca por cliente
CREATE INDEX idx_client_custom_items_client_id 
  ON public.client_custom_items(client_id);