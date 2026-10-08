-- Criar tabela específica para inventário patrimonial
CREATE TABLE public.patrimony_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  acquisition_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  acquisition_date DATE NOT NULL,
  condition TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_number TEXT,
  location TEXT NOT NULL,
  description TEXT,
  current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL DEFAULT gen_random_uuid()
);

-- Habilitar RLS
ALTER TABLE public.patrimony_inventory ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Users can view patrimony inventory" 
ON public.patrimony_inventory 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage patrimony inventory" 
ON public.patrimony_inventory 
FOR ALL 
USING (auth.uid() IS NOT NULL AND (current_user_has_role('admin'::app_role) OR current_user_has_role('financeiro'::app_role)));

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_patrimony_inventory_updated_at
BEFORE UPDATE ON public.patrimony_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();