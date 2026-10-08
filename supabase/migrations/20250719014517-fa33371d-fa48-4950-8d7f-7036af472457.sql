-- Remove as políticas RLS restritivas das tabelas equipment e events
-- já que o sistema usa autenticação customizada e controle de permissões próprio

-- Dropar políticas existentes da tabela equipment
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Authenticated users can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Authenticated users can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Authenticated users can delete equipment" ON public.equipment;

-- Dropar políticas existentes da tabela events  
DROP POLICY IF EXISTS "Anyone authenticated can view events" ON public.events;
DROP POLICY IF EXISTS "Anyone authenticated can insert events" ON public.events;
DROP POLICY IF EXISTS "Anyone authenticated can update events" ON public.events;
DROP POLICY IF EXISTS "Anyone authenticated can delete events" ON public.events;

-- Criar políticas mais permissivas que funcionam com o sistema customizado
-- Equipment policies
CREATE POLICY "Allow all access to equipment" ON public.equipment
FOR ALL USING (true) WITH CHECK (true);

-- Events policies  
CREATE POLICY "Allow all access to events" ON public.events
FOR ALL USING (true) WITH CHECK (true);

-- Manter RLS habilitado mas com políticas permissivas
-- Isso permite que o controle de acesso seja feito na aplicação
-- através do sistema de permissões customizado