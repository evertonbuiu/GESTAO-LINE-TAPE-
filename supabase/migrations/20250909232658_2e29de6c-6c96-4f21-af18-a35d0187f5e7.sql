-- Remover políticas RLS existentes da tabela contracts que dependem de auth.uid()
DROP POLICY IF EXISTS "Users can view all contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and financeiro can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and financeiro can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and financeiro can delete contracts" ON public.contracts;

-- Criar políticas RLS mais simples que funcionam com autenticação customizada
-- Permitir visualização para todos (já que o controle é feito na aplicação)
CREATE POLICY "Allow all users to view contracts" 
ON public.contracts 
FOR SELECT 
USING (true);

-- Permitir inserção para todos (controle é feito na aplicação)
CREATE POLICY "Allow all users to insert contracts" 
ON public.contracts 
FOR INSERT 
WITH CHECK (true);

-- Permitir atualização para todos (controle é feito na aplicação)
CREATE POLICY "Allow all users to update contracts" 
ON public.contracts 
FOR UPDATE 
USING (true);

-- Permitir exclusão para todos (controle é feito na aplicação)
CREATE POLICY "Allow all users to delete contracts" 
ON public.contracts 
FOR DELETE 
USING (true);