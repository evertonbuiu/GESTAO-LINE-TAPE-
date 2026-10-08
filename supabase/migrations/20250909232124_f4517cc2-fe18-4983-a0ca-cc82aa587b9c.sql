-- Remover políticas existentes da tabela contracts
DROP POLICY IF EXISTS "Only admins and financeiro can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view all contracts" ON public.contracts;

-- Criar novas políticas RLS mais robustas para contracts
CREATE POLICY "Users can view all contracts" 
ON public.contracts 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and financeiro can insert contracts" 
ON public.contracts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY(ARRAY['admin'::app_role, 'financeiro'::app_role])
  )
);

CREATE POLICY "Admins and financeiro can update contracts" 
ON public.contracts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY(ARRAY['admin'::app_role, 'financeiro'::app_role])
  )
);

CREATE POLICY "Admins and financeiro can delete contracts" 
ON public.contracts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY(ARRAY['admin'::app_role, 'financeiro'::app_role])
  )
);