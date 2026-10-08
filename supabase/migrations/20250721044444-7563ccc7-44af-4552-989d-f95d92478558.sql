-- Garantir acesso total para usuários admin em todas as tabelas
-- Remover políticas restritivas e criar políticas que dão acesso total para admin

-- Equipment - Admin total + outros com permissões
DROP POLICY IF EXISTS "View equipment permission" ON public.equipment;
DROP POLICY IF EXISTS "Manage equipment permission" ON public.equipment;

CREATE POLICY "Admin full access to equipment" ON public.equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view equipment with permission" ON public.equipment
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'inventory_view', 'view'))
);

CREATE POLICY "Users manage equipment with permission" ON public.equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'inventory_edit', 'edit'))
);

-- Events - Admin total + outros com permissões  
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.events;

CREATE POLICY "Admin full access to events" ON public.events
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view events with permission" ON public.events
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_view', 'view'))
);

CREATE POLICY "Users manage events with permission" ON public.events
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit', 'edit'))
);

-- Clients - Admin total + outros com permissões
DROP POLICY IF EXISTS "View clients permission" ON public.clients;
DROP POLICY IF EXISTS "Manage clients permission" ON public.clients;

CREATE POLICY "Admin full access to clients" ON public.clients
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view clients with permission" ON public.clients
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'clients_view', 'view'))
);

CREATE POLICY "Users manage clients with permission" ON public.clients
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'clients_edit', 'edit'))
);

-- Event Equipment - Admin total + outros com permissões
DROP POLICY IF EXISTS "View event equipment permission" ON public.event_equipment;
DROP POLICY IF EXISTS "Manage event equipment permission" ON public.event_equipment;

CREATE POLICY "Admin full access to event equipment" ON public.event_equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view event equipment with permission" ON public.event_equipment
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_view', 'view'))
);

CREATE POLICY "Users manage event equipment with permission" ON public.event_equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit', 'edit'))
);

-- Maintenance Records - Admin total + outros com permissões
DROP POLICY IF EXISTS "View maintenance permission" ON public.maintenance_records;
DROP POLICY IF EXISTS "Manage maintenance permission" ON public.maintenance_records;

CREATE POLICY "Admin full access to maintenance" ON public.maintenance_records
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view maintenance with permission" ON public.maintenance_records
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'maintenance_view', 'view'))
);

CREATE POLICY "Users manage maintenance with permission" ON public.maintenance_records
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'maintenance_edit', 'edit'))
);

-- Event Expenses - Admin total + outros com permissões
DROP POLICY IF EXISTS "View event expenses permission" ON public.event_expenses;
DROP POLICY IF EXISTS "Manage event expenses permission" ON public.event_expenses;

CREATE POLICY "Admin full access to event expenses" ON public.event_expenses
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view event expenses with permission" ON public.event_expenses
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR 
   has_permission(auth.uid(), 'rentals_view', 'view') OR 
   has_permission(auth.uid(), 'financial_view', 'view'))
);

CREATE POLICY "Users manage event expenses with permission" ON public.event_expenses
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'financial_edit', 'edit'))
);

-- Collaborators - Admin total + outros com permissões
DROP POLICY IF EXISTS "View collaborators permission" ON public.collaborators;
DROP POLICY IF EXISTS "Manage collaborators permission" ON public.collaborators;

CREATE POLICY "Admin full access to collaborators" ON public.collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view collaborators with permission" ON public.collaborators
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'user_management_view', 'view'))
);

CREATE POLICY "Users manage collaborators with permission" ON public.collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'user_management_edit', 'edit'))
);

-- Event Collaborators - Admin total + outros com permissões
DROP POLICY IF EXISTS "View event collaborators permission" ON public.event_collaborators;
DROP POLICY IF EXISTS "Manage event collaborators permission" ON public.event_collaborators;

CREATE POLICY "Admin full access to event collaborators" ON public.event_collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND current_user_has_role('admin'::app_role)
);

CREATE POLICY "Users view event collaborators with permission" ON public.event_collaborators
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'user_management_view', 'view'))
);

CREATE POLICY "Users manage event collaborators with permission" ON public.event_collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'user_management_edit', 'edit'))
);