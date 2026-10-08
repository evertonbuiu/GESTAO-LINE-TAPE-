-- Criar tabela para configurações da empresa
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'Luz Locação',
  tagline text DEFAULT 'Controle de Estoque',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir configuração inicial
INSERT INTO public.company_settings (company_name, tagline) 
VALUES ('Luz Locação', 'Controle de Estoque');

-- Habilitar RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Anyone can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();