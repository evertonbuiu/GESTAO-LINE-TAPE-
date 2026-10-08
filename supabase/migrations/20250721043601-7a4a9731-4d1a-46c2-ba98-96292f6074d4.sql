-- Refazer todas as políticas RLS do sistema
-- Primeiro, remover todas as políticas existentes

-- Equipment policies
DROP POLICY IF EXISTS "Admin can do everything on equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can manage equipment" ON public.equipment;
DROP POLICY IF EXISTS "Allow all access to equipment" ON public.equipment;

-- Events policies
DROP POLICY IF EXISTS "Admin can do everything on events" ON public.events;
DROP POLICY IF EXISTS "Users can view events" ON public.events;
DROP POLICY IF EXISTS "Users can manage events" ON public.events;
DROP POLICY IF EXISTS "Allow all access to events" ON public.events;

-- Clients policies
DROP POLICY IF EXISTS "Admin can do everything on clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients" ON public.clients;

-- Equipment policies - baseadas em permissões específicas
CREATE POLICY "View equipment permission" ON public.equipment
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'inventory_view', 'view')
);

CREATE POLICY "Manage equipment permission" ON public.equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'inventory_edit', 'edit')
);

-- Events policies - baseadas em permissões específicas
CREATE POLICY "View events permission" ON public.events
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'rentals_view', 'view')
);

CREATE POLICY "Manage events permission" ON public.events
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'rentals_edit', 'edit')
);

-- Clients policies - baseadas em permissões específicas
CREATE POLICY "View clients permission" ON public.clients
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'clients_view', 'view')
);

CREATE POLICY "Manage clients permission" ON public.clients
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'clients_edit', 'edit')
);

-- Event Equipment policies
DROP POLICY IF EXISTS "All users can view event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "All users can insert event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "All users can update event equipment" ON public.event_equipment;
DROP POLICY IF EXISTS "All users can delete event equipment" ON public.event_equipment;

CREATE POLICY "View event equipment permission" ON public.event_equipment
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'rentals_view', 'view')
);

CREATE POLICY "Manage event equipment permission" ON public.event_equipment
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'rentals_edit', 'edit')
);

-- Maintenance Records policies
DROP POLICY IF EXISTS "All users can view maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "All users can insert maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "All users can update maintenance records" ON public.maintenance_records;
DROP POLICY IF EXISTS "All users can delete maintenance records" ON public.maintenance_records;

CREATE POLICY "View maintenance permission" ON public.maintenance_records
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'maintenance_view', 'view')
);

CREATE POLICY "Manage maintenance permission" ON public.maintenance_records
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'maintenance_edit', 'edit')
);

-- Event Expenses policies
DROP POLICY IF EXISTS "All users can view expenses" ON public.event_expenses;
DROP POLICY IF EXISTS "All users can manage expenses" ON public.event_expenses;

CREATE POLICY "View event expenses permission" ON public.event_expenses
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (has_permission(auth.uid(), 'rentals_view', 'view') OR 
   has_permission(auth.uid(), 'financial_view', 'view'))
);

CREATE POLICY "Manage event expenses permission" ON public.event_expenses
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'financial_edit', 'edit')
);

-- Event Collaborators policies
DROP POLICY IF EXISTS "Users can view event collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can insert event collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can update event collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can delete event collaborators" ON public.event_collaborators;

CREATE POLICY "View event collaborators permission" ON public.event_collaborators
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'user_management_view', 'view')
);

CREATE POLICY "Manage event collaborators permission" ON public.event_collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'user_management_edit', 'edit')
);

-- Collaborators policies
DROP POLICY IF EXISTS "Users can view collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can insert collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can update collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can delete collaborators" ON public.collaborators;

CREATE POLICY "View collaborators permission" ON public.collaborators
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'user_management_view', 'view')
);

CREATE POLICY "Manage collaborators permission" ON public.collaborators
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  has_permission(auth.uid(), 'user_management_edit', 'edit')
);

-- Bank Accounts - apenas admin e financeiro
DROP POLICY IF EXISTS "Admin can do everything on bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Financial users can view bank accounts" ON public.bank_accounts;

CREATE POLICY "View bank accounts permission" ON public.bank_accounts
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR 
   current_user_has_role('financeiro'::app_role))
);

CREATE POLICY "Manage bank accounts permission" ON public.bank_accounts
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  current_user_has_role('admin'::app_role)
);

-- Bank Transactions - apenas admin e financeiro
DROP POLICY IF EXISTS "Admins can manage bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can view bank transactions" ON public.bank_transactions;

CREATE POLICY "View bank transactions permission" ON public.bank_transactions
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR 
   current_user_has_role('financeiro'::app_role))
);

CREATE POLICY "Manage bank transactions permission" ON public.bank_transactions
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  current_user_has_role('admin'::app_role)
);

-- Company Expenses - admin e financeiro
DROP POLICY IF EXISTS "Admin can do everything on company expenses" ON public.company_expenses;
DROP POLICY IF EXISTS "Financial users can view company expenses" ON public.company_expenses;
DROP POLICY IF EXISTS "Financial users can manage company expenses" ON public.company_expenses;

CREATE POLICY "View company expenses permission" ON public.company_expenses
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR 
   current_user_has_role('financeiro'::app_role))
);

CREATE POLICY "Manage company expenses permission" ON public.company_expenses
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (current_user_has_role('admin'::app_role) OR 
   current_user_has_role('financeiro'::app_role))
);

-- User Roles - apenas admin pode gerenciar
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "Admins can manage all user roles" ON public.user_roles
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  current_user_has_role('admin'::app_role)
);

-- User Credentials - apenas admin
DROP POLICY IF EXISTS "Only admins can manage user credentials" ON public.user_credentials;
DROP POLICY IF EXISTS "Users can view their own credentials" ON public.user_credentials;

CREATE POLICY "Users can view their own credentials" ON public.user_credentials
FOR SELECT USING (
  auth.uid() = id
);

CREATE POLICY "Admins can manage all user credentials" ON public.user_credentials
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  current_user_has_role('admin'::app_role)
);

-- Company Settings - todos podem ver, apenas admin pode editar
DROP POLICY IF EXISTS "Allow public access to company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;

CREATE POLICY "Anyone can view company settings" ON public.company_settings
FOR SELECT USING (true);

CREATE POLICY "Admins can manage company settings" ON public.company_settings
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  current_user_has_role('admin'::app_role)
);