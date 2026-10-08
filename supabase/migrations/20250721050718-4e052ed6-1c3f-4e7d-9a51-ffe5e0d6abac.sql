-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view patrimony inventory" ON public.patrimony_inventory;
DROP POLICY IF EXISTS "Users can manage patrimony inventory" ON public.patrimony_inventory;

-- Criar políticas permissivas para o sistema de autenticação customizado
CREATE POLICY "Allow access to patrimony inventory" 
ON public.patrimony_inventory 
FOR ALL 
USING (true) 
WITH CHECK (true);