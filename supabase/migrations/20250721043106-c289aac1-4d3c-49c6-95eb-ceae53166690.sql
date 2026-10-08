-- Liberar todas as políticas RLS para usuários admin
-- Equipment policies
DROP POLICY IF EXISTS "Users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can delete equipment" ON public.equipment;

CREATE POLICY "Admin can do everything on equipment" ON public.equipment
FOR ALL USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Users can view equipment" ON public.equipment
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage equipment" ON public.equipment
FOR ALL USING (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'inventory_edit', 'edit'));

-- Events policies  
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
DROP POLICY IF EXISTS "Authorized users can manage events" ON public.events;

CREATE POLICY "Admin can do everything on events" ON public.events
FOR ALL USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Users can view events" ON public.events
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage events" ON public.events
FOR ALL USING (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'events_edit', 'edit'));

-- Clients policies
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authorized users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authorized users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authorized users can delete clients" ON public.clients;

CREATE POLICY "Admin can do everything on clients" ON public.clients
FOR ALL USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Users can view clients" ON public.clients
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage clients" ON public.clients
FOR ALL USING (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'clients_edit', 'edit'));

-- Bank accounts - Admin full access
DROP POLICY IF EXISTS "Financial users can view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Only admins can manage bank accounts" ON public.bank_accounts;

CREATE POLICY "Admin can do everything on bank accounts" ON public.bank_accounts
FOR ALL USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Financial users can view bank accounts" ON public.bank_accounts
FOR SELECT USING (auth.uid() IS NOT NULL AND (current_user_has_role('admin'::app_role) OR current_user_has_role('financeiro'::app_role)));

-- Company expenses - Admin full access
DROP POLICY IF EXISTS "Financial users can manage company expenses" ON public.company_expenses;
DROP POLICY IF EXISTS "Financial users can view company expenses" ON public.company_expenses;

CREATE POLICY "Admin can do everything on company expenses" ON public.company_expenses
FOR ALL USING (current_user_has_role('admin'::app_role));

CREATE POLICY "Financial users can view company expenses" ON public.company_expenses
FOR SELECT USING (auth.uid() IS NOT NULL AND (current_user_has_role('admin'::app_role) OR current_user_has_role('financeiro'::app_role)));

CREATE POLICY "Financial users can manage company expenses" ON public.company_expenses
FOR ALL USING (current_user_has_role('admin'::app_role) OR (auth.uid() IS NOT NULL AND current_user_has_role('financeiro'::app_role)));