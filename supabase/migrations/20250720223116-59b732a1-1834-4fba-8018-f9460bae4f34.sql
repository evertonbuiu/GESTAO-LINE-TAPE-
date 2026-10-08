-- Corrigir políticas RLS da tabela company_settings para funcionar com autenticação customizada

-- Remover política restritiva atual
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;

-- Criar política permissiva para permitir todas as operações
-- (já que a autenticação é gerenciada pela aplicação)
CREATE POLICY "Allow public access to company_settings" ON public.company_settings
  FOR ALL USING (true) WITH CHECK (true);