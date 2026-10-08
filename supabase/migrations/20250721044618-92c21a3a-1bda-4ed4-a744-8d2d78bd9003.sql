-- Temporariamente permitir acesso total aos eventos para todos os usuários autenticados
-- para diagnosticar o problema

DROP POLICY IF EXISTS "Admin full access to events" ON public.events;
DROP POLICY IF EXISTS "Users view events with permission" ON public.events;
DROP POLICY IF EXISTS "Users manage events with permission" ON public.events;

-- Política simples para depuração
CREATE POLICY "All authenticated users can access events" ON public.events
FOR ALL USING (auth.uid() IS NOT NULL);