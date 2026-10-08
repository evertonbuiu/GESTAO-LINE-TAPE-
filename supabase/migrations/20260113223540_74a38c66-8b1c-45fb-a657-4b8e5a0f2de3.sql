-- ============================================
-- SISTEMA LINE TAPE 2026 - MIGRAÇÃO COMPLETA
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: bank_accounts (Contas Bancárias)
-- ============================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  agency TEXT,
  account_type TEXT,
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: bank_transactions (Transações Bancárias)
-- ============================================
CREATE TABLE public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on bank_transactions" ON public.bank_transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: clients (Clientes)
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: equipment (Equipamentos)
-- ============================================
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  total_stock INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  rented INTEGER DEFAULT 0,
  price_per_day NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'available',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on equipment" ON public.equipment FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: events (Eventos/Locações)
-- ============================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  setup_start_date DATE,
  event_date DATE NOT NULL,
  event_time TEXT,
  location TEXT,
  description TEXT,
  total_budget NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  profit_margin NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  is_paid BOOLEAN DEFAULT false,
  payment_date DATE,
  payment_bank_account TEXT,
  payment_amount NUMERIC DEFAULT 0,
  payment_type TEXT,
  remaining_payment_amount NUMERIC DEFAULT 0,
  remaining_payment_date DATE,
  remaining_payment_bank_account TEXT,
  is_remaining_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on events" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: event_expenses (Despesas de Eventos)
-- ============================================
CREATE TABLE public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  receipt_url TEXT,
  expense_bank_account TEXT,
  expense_date DATE,
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on event_expenses" ON public.event_expenses FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: event_budgets (Orçamentos de Eventos)
-- ============================================
CREATE TABLE public.event_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  image_url TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on event_budgets" ON public.event_budgets FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: company_expenses (Despesas da Empresa)
-- ============================================
CREATE TABLE public.company_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  receipt_url TEXT,
  expense_bank_account TEXT,
  payment_bank_account TEXT,
  expense_date DATE,
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on company_expenses" ON public.company_expenses FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: collaborators (Colaboradores)
-- ============================================
CREATE TABLE public.collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT DEFAULT 'active',
  pix_key TEXT,
  bank_account TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on collaborators" ON public.collaborators FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: collaborator_payments (Pagamentos de Colaboradores)
-- ============================================
CREATE TABLE public.collaborator_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.collaborator_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on collaborator_payments" ON public.collaborator_payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: daily_rates (Diárias)
-- ============================================
CREATE TABLE public.daily_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  is_finalized BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.daily_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on daily_rates" ON public.daily_rates FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: maintenance_records (Registros de Manutenção)
-- ============================================
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  equipment_name TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  status TEXT DEFAULT 'agendada',
  priority TEXT DEFAULT 'normal',
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  description TEXT NOT NULL,
  problem_description TEXT,
  solution_description TEXT,
  cost NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  technician_name TEXT,
  technician_contact TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on maintenance_records" ON public.maintenance_records FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: contracts (Contratos)
-- ============================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_document TEXT,
  service_description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value NUMERIC DEFAULT 0,
  payment_terms TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contracts" ON public.contracts FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: contract_payments (Pagamentos de Contratos)
-- ============================================
CREATE TABLE public.contract_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contract_payments" ON public.contract_payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: patrimony_inventory (Inventário Patrimonial)
-- ============================================
CREATE TABLE public.patrimony_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  acquisition_value NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  acquisition_date DATE,
  condition TEXT,
  location TEXT,
  serial_number TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.patrimony_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on patrimony_inventory" ON public.patrimony_inventory FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: external_quotes (Orçamentos Externos)
-- ============================================
CREATE TABLE public.external_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  quote_number TEXT,
  supplier_name TEXT,
  description TEXT,
  items JSONB,
  total_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.external_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on external_quotes" ON public.external_quotes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: company_settings (Configurações da Empresa)
-- ============================================
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  tagline TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  cnpj TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on company_settings" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

-- Inserir registro padrão de company_settings
INSERT INTO public.company_settings (company_name, tagline) VALUES ('Line Tape', 'Controle de Estoque');

-- ============================================
-- TABELA: user_credentials (Credenciais de Usuários)
-- ============================================
CREATE TABLE public.user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_credentials" ON public.user_credentials FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: user_roles (Roles de Usuários)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_credentials(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'funcionario', 'financeiro', 'deposito')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_roles" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: permissions (Permissões)
-- ============================================
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on permissions" ON public.permissions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: role_permissions (Permissões por Role)
-- ============================================
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on role_permissions" ON public.role_permissions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: user_permissions (Permissões de Usuário)
-- ============================================
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_credentials(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_permissions" ON public.user_permissions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: saved_signatures (Assinaturas Salvas)
-- ============================================
CREATE TABLE public.saved_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  user_id TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.saved_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on saved_signatures" ON public.saved_signatures FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INSERIR PERMISSÕES PADRÃO
-- ============================================
INSERT INTO public.permissions (name, description, category) VALUES
('dashboard', 'Acesso ao Dashboard', 'Geral'),
('equipment', 'Gerenciamento de Equipamentos', 'Operações'),
('inventory', 'Controle de Estoque', 'Operações'),
('rentals', 'Gerenciamento de Locações', 'Operações'),
('maintenance', 'Manutenção de Equipamentos', 'Operações'),
('clients', 'Gerenciamento de Clientes', 'Comercial'),
('collaborators', 'Gerenciamento de Colaboradores', 'RH'),
('daily_rates', 'Gerenciamento de Diárias', 'RH'),
('financial', 'Gestão Financeira', 'Financeiro'),
('accounts', 'Contas Bancárias', 'Financeiro'),
('contracts', 'Contratos', 'Comercial'),
('reports', 'Relatórios', 'Geral'),
('settings', 'Configurações do Sistema', 'Administração');

-- ============================================
-- INSERIR PERMISSÕES POR ROLE
-- ============================================
-- Admin tem todas as permissões
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'admin', id, true, true FROM public.permissions;

-- Financeiro tem acesso a áreas financeiras
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'financeiro', id, true, true FROM public.permissions 
WHERE name IN ('dashboard', 'financial', 'accounts', 'contracts', 'reports', 'clients', 'rentals');

-- Depósito tem acesso a áreas operacionais
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'deposito', id, true, true FROM public.permissions 
WHERE name IN ('dashboard', 'equipment', 'inventory', 'rentals', 'maintenance', 'clients');

-- Funcionário tem acesso básico
INSERT INTO public.role_permissions (role, permission_id, can_view, can_edit)
SELECT 'funcionario', id, true, false FROM public.permissions 
WHERE name IN ('dashboard', 'equipment', 'inventory', 'rentals');

-- ============================================
-- FUNÇÃO: authenticate_user (Autenticação)
-- ============================================
CREATE OR REPLACE FUNCTION public.authenticate_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.id as user_id,
    uc.username,
    uc.name,
    COALESCE(ur.role, 'funcionario') as role
  FROM public.user_credentials uc
  LEFT JOIN public.user_roles ur ON ur.user_id = uc.id
  WHERE uc.username = p_username 
    AND uc.password_hash = p_password
    AND uc.is_active = true;
END;
$$;

-- ============================================
-- FUNÇÃO: has_permission (Verificar Permissão)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID, 
  _permission_name TEXT, 
  _access_type TEXT DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  has_access BOOLEAN := false;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id;

  -- Admin always has access
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Check role permissions
  IF _access_type = 'view' THEN
    SELECT rp.can_view INTO has_access
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role = user_role AND p.name = _permission_name;
  ELSE
    SELECT rp.can_edit INTO has_access
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role = user_role AND p.name = _permission_name;
  END IF;

  RETURN COALESCE(has_access, false);
END;
$$;

-- ============================================
-- CRIAR USUÁRIO ADMIN PADRÃO
-- ============================================
INSERT INTO public.user_credentials (id, username, password_hash, name) 
VALUES (gen_random_uuid(), 'admin', gen_random_uuid()::text || gen_random_uuid()::text, 'Administrador');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.user_credentials WHERE username = 'admin';

-- ============================================
-- CRIAR BUCKET DE STORAGE PARA LOGOS E EQUIPAMENTOS
-- ============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para logos
CREATE POLICY "Public access to logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'logos');

-- Políticas de storage para equipment-images
CREATE POLICY "Public access to equipment-images" ON storage.objects FOR SELECT USING (bucket_id = 'equipment-images');
CREATE POLICY "Authenticated users can upload equipment-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'equipment-images');
CREATE POLICY "Authenticated users can update equipment-images" ON storage.objects FOR UPDATE USING (bucket_id = 'equipment-images');
CREATE POLICY "Authenticated users can delete equipment-images" ON storage.objects FOR DELETE USING (bucket_id = 'equipment-images');

-- Políticas de storage para receipts
CREATE POLICY "Public access to receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Authenticated users can update receipts" ON storage.objects FOR UPDATE USING (bucket_id = 'receipts');
CREATE POLICY "Authenticated users can delete receipts" ON storage.objects FOR DELETE USING (bucket_id = 'receipts');
