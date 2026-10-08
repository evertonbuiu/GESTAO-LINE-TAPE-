-- Criar tabela para colaboradores
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'funcionario',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

-- Criar políticas para a tabela de colaboradores
CREATE POLICY "Users can view collaborators"
  ON public.collaborators FOR SELECT
  USING (true);

CREATE POLICY "Users can insert collaborators"
  ON public.collaborators FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update collaborators"
  ON public.collaborators FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete collaborators"
  ON public.collaborators FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais
INSERT INTO public.collaborators (name, email, phone, role, status, created_by)
VALUES 
  ('João Silva', 'joao@empresa.com', '(11) 99999-9999', 'funcionario', 'active', gen_random_uuid()),
  ('Maria Santos', 'maria@empresa.com', '(11) 88888-8888', 'admin', 'active', gen_random_uuid());