-- Liberar acesso às tabelas principais para todos os usuários autenticados
-- Atualizar políticas RLS para ser mais permissivas

-- Política para equipment - permitir visualização para todos os usuários
DROP POLICY IF EXISTS "Allow all access to equipment" ON public.equipment;
CREATE POLICY "Users can view equipment" ON public.equipment
FOR SELECT USING (true);

CREATE POLICY "Users can manage equipment" ON public.equipment
FOR ALL USING (true) WITH CHECK (true);

-- Política para maintenance_records - permitir acesso para todos os usuários
DROP POLICY IF EXISTS "Users can view maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can insert maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can update maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can delete maintenance records" ON public.maintenance_records;

CREATE POLICY "All users can view maintenance records" ON public.maintenance_records
FOR SELECT USING (true);

CREATE POLICY "All users can insert maintenance records" ON public.maintenance_records
FOR INSERT WITH CHECK (true);

CREATE POLICY "All users can update maintenance records" ON public.maintenance_records
FOR UPDATE USING (true);

CREATE POLICY "All users can delete maintenance records" ON public.maintenance_records
FOR DELETE USING (true);

-- Política para events - permitir acesso para todos os usuários
DROP POLICY IF EXISTS "Allow all access to events" ON public.events;
CREATE POLICY "All users can view events" ON public.events
FOR SELECT USING (true);

CREATE POLICY "All users can manage events" ON public.events
FOR ALL USING (true) WITH CHECK (true);

-- Política para event_equipment - permitir acesso para todos os usuários
DROP POLICY IF EXISTS "Authenticated users can view event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "Authenticated users can insert event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "Authenticated users can update event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "Authenticated users can delete event equipment" ON public.event_equipment;

CREATE POLICY "All users can view event equipment" ON public.event_equipment
FOR SELECT USING (true);

CREATE POLICY "All users can insert event equipment" ON public.event_equipment
FOR INSERT WITH CHECK (true);

CREATE POLICY "All users can update event equipment" ON public.event_equipment
FOR UPDATE USING (true);

CREATE POLICY "All users can delete event equipment" ON public.event_equipment
FOR DELETE USING (true);

-- Política para clients - manter como está (já permite acesso para todos)

-- Política para collaborators - manter como está (já permite acesso para todos)

-- Política para event_expenses - liberar para todos os usuários (não só admins)
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.event_expenses;
DROP POLICY IF EXISTS "Admins can manage all expenses" ON public.event_expenses;

CREATE POLICY "All users can view expenses" ON public.event_expenses
FOR SELECT USING (true);

CREATE POLICY "All users can manage expenses" ON public.event_expenses
FOR ALL USING (true) WITH CHECK (true);