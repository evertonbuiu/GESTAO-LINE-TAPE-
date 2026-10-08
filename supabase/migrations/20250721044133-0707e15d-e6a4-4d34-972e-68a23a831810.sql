-- Ajustar política de eventos para permitir criação por usuários autenticados
-- Temporariamente permitir que qualquer usuário autenticado possa criar eventos

DROP POLICY IF EXISTS "View events permission" ON public.events;
DROP POLICY IF EXISTS "Manage events permission" ON public.events;

-- Política mais permissiva para depuração
CREATE POLICY "Authenticated users can view events" ON public.events
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create events" ON public.events
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update events" ON public.events
FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete events" ON public.events
FOR DELETE USING (auth.uid() IS NOT NULL);