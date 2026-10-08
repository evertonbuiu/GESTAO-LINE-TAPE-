-- =====================================================
-- MIGRAÇÃO COMPLETA DO LINETAPE004
-- =====================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Criar tipo ENUM para roles (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'funcionario', 'financeiro', 'deposito');
    END IF;
END$$;

-- =====================================================
-- NOVAS TABELAS
-- =====================================================

-- Tabela: approval_requests
CREATE TABLE IF NOT EXISTS public.approval_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requested_by UUID NOT NULL,
    requested_operation TEXT NOT NULL,
    operation_details JSONB NOT NULL,
    target_resource_type TEXT NOT NULL,
    target_resource_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    approved_by UUID,
    approval_reason TEXT,
    rejection_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + '7 days'::interval),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    operation TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna balance em bank_accounts se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bank_accounts' AND column_name = 'balance') THEN
        ALTER TABLE public.bank_accounts ADD COLUMN balance NUMERIC DEFAULT 0.00;
    END IF;
END$$;

-- Tabela: bank_cards
CREATE TABLE IF NOT EXISTS public.bank_cards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    card_type TEXT NOT NULL,
    bank TEXT NOT NULL,
    limit_amount NUMERIC,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    available_limit NUMERIC,
    due_date INTEGER,
    closing_date INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: bank_card_transactions
CREATE TABLE IF NOT EXISTS public.bank_card_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.bank_cards(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    transaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em bank_transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bank_transactions' AND column_name = 'reference_type') THEN
        ALTER TABLE public.bank_transactions ADD COLUMN reference_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bank_transactions' AND column_name = 'reference_id') THEN
        ALTER TABLE public.bank_transactions ADD COLUMN reference_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bank_transactions' AND column_name = 'receipt_url') THEN
        ALTER TABLE public.bank_transactions ADD COLUMN receipt_url TEXT;
    END IF;
END$$;

-- Tabela: client_advances
CREATE TABLE IF NOT EXISTS public.client_advances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: client_custom_items
CREATE TABLE IF NOT EXISTS public.client_custom_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    fabrication_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em collaborators
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collaborators' AND column_name = 'created_by') THEN
        ALTER TABLE public.collaborators ADD COLUMN created_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collaborators' AND column_name = 'bank_account') THEN
        ALTER TABLE public.collaborators ADD COLUMN bank_account TEXT;
    END IF;
END$$;

-- Tabela: collaborator_advances
CREATE TABLE IF NOT EXISTS public.collaborator_advances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: collaborator_expense_advances
CREATE TABLE IF NOT EXISTS public.collaborator_expense_advances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: collaborator_monthly_salaries
CREATE TABLE IF NOT EXISTS public.collaborator_monthly_salaries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    salary_month INTEGER NOT NULL,
    salary_year INTEGER NOT NULL,
    salary_amount NUMERIC NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em company_expenses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_expenses' AND column_name = 'is_paid') THEN
        ALTER TABLE public.company_expenses ADD COLUMN is_paid BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_expenses' AND column_name = 'created_by') THEN
        ALTER TABLE public.company_expenses ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Tabela: company_fixed_expenses
CREATE TABLE IF NOT EXISTS public.company_fixed_expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    monthly_amount NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: company_fixed_expense_monthly_payments
CREATE TABLE IF NOT EXISTS public.company_fixed_expense_monthly_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_fixed_expense_id UUID NOT NULL REFERENCES public.company_fixed_expenses(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    payment_month INTEGER NOT NULL,
    payment_year INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount NUMERIC NOT NULL DEFAULT 0,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em contracts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'created_by') THEN
        ALTER TABLE public.contracts ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Tabela: contract_attachments
CREATE TABLE IF NOT EXISTS public.contract_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em equipment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment' AND column_name = 'budget_pdf_url') THEN
        ALTER TABLE public.equipment ADD COLUMN budget_pdf_url TEXT;
    END IF;
END$$;

-- Adicionar colunas extras em user_credentials
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credentials' AND column_name = 'password_salt') THEN
        ALTER TABLE public.user_credentials ADD COLUMN password_salt TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credentials' AND column_name = 'last_login') THEN
        ALTER TABLE public.user_credentials ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END$$;

-- Adicionar colunas extras em events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'created_by') THEN
        ALTER TABLE public.events ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Adicionar colunas extras em event_budgets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_budgets' AND column_name = 'pdf_url') THEN
        ALTER TABLE public.event_budgets ADD COLUMN pdf_url TEXT;
    END IF;
END$$;

-- Tabela: event_collaborators
CREATE TABLE IF NOT EXISTS public.event_collaborators (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    collaborator_name TEXT NOT NULL,
    collaborator_email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'funcionario'::text,
    reference_type TEXT,
    reference_id UUID,
    assigned_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: event_contracts
CREATE TABLE IF NOT EXISTS public.event_contracts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    budget_number TEXT,
    company_name TEXT NOT NULL DEFAULT 'Luz Locação'::text,
    company_address TEXT,
    company_phone TEXT,
    company_email TEXT,
    company_document TEXT,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_document TEXT,
    client_address TEXT,
    client_phone TEXT,
    event_date DATE,
    event_location TEXT,
    initial_setup_date DATE,
    decorator TEXT,
    technical_responsible TEXT,
    products JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    discount_rate NUMERIC DEFAULT 0,
    with_discount BOOLEAN DEFAULT false,
    tax NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 15,
    with_tax BOOLEAN DEFAULT false,
    total NUMERIC DEFAULT 0,
    service_description TEXT,
    payment_terms TEXT,
    delivery_terms TEXT,
    cancellation_policy TEXT,
    warranty_terms TEXT,
    additional_terms TEXT,
    company_signature TEXT,
    client_signature TEXT,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    signed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: event_equipment
CREATE TABLE IF NOT EXISTS public.event_equipment (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    equipment_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    budget_pdf_url TEXT,
    image_url TEXT,
    assigned_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em event_expenses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'payment_bank_account') THEN
        ALTER TABLE public.event_expenses ADD COLUMN payment_bank_account TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'is_paid') THEN
        ALTER TABLE public.event_expenses ADD COLUMN is_paid BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'reference_type') THEN
        ALTER TABLE public.event_expenses ADD COLUMN reference_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'reference_id') THEN
        ALTER TABLE public.event_expenses ADD COLUMN reference_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'is_finalized') THEN
        ALTER TABLE public.event_expenses ADD COLUMN is_finalized BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_expenses' AND column_name = 'created_by') THEN
        ALTER TABLE public.event_expenses ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Adicionar colunas extras em external_quotes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'client_name') THEN
        ALTER TABLE public.external_quotes ADD COLUMN client_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'client_email') THEN
        ALTER TABLE public.external_quotes ADD COLUMN client_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'client_phone') THEN
        ALTER TABLE public.external_quotes ADD COLUMN client_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'client_document') THEN
        ALTER TABLE public.external_quotes ADD COLUMN client_document TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'client_address') THEN
        ALTER TABLE public.external_quotes ADD COLUMN client_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'event_name') THEN
        ALTER TABLE public.external_quotes ADD COLUMN event_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'event_location') THEN
        ALTER TABLE public.external_quotes ADD COLUMN event_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'event_date') THEN
        ALTER TABLE public.external_quotes ADD COLUMN event_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'initial_setup_date') THEN
        ALTER TABLE public.external_quotes ADD COLUMN initial_setup_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'decorator_name') THEN
        ALTER TABLE public.external_quotes ADD COLUMN decorator_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'technical_responsible') THEN
        ALTER TABLE public.external_quotes ADD COLUMN technical_responsible TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'quote_date') THEN
        ALTER TABLE public.external_quotes ADD COLUMN quote_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'products') THEN
        ALTER TABLE public.external_quotes ADD COLUMN products JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'subtotal') THEN
        ALTER TABLE public.external_quotes ADD COLUMN subtotal NUMERIC NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'discount_percentage') THEN
        ALTER TABLE public.external_quotes ADD COLUMN discount_percentage NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.external_quotes ADD COLUMN discount_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'travel_expense') THEN
        ALTER TABLE public.external_quotes ADD COLUMN travel_expense NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'accommodation_expense') THEN
        ALTER TABLE public.external_quotes ADD COLUMN accommodation_expense NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'tax_option') THEN
        ALTER TABLE public.external_quotes ADD COLUMN tax_option TEXT DEFAULT 'sem_nota'::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'total_amount') THEN
        ALTER TABLE public.external_quotes ADD COLUMN total_amount NUMERIC NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_quotes' AND column_name = 'created_by') THEN
        ALTER TABLE public.external_quotes ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Tabela: interstate_transports
CREATE TABLE IF NOT EXISTS public.interstate_transports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    transport_date DATE NOT NULL,
    driver_name TEXT NOT NULL,
    driver_cpf TEXT,
    vehicle_plate TEXT NOT NULL,
    origin_state TEXT,
    destination TEXT NOT NULL,
    cargo_type TEXT,
    cargo_weight NUMERIC,
    cargo_value NUMERIC,
    invoice_number TEXT,
    equipment_list JSONB,
    material_list JSONB,
    total_weight NUMERIC,
    estimated_cost NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    return_date DATE,
    return_status TEXT,
    return_notes TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em maintenance_records
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'technician_contact') THEN
        ALTER TABLE public.maintenance_records ADD COLUMN technician_contact TEXT;
    END IF;
END$$;

-- Tabela: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: recurring_expenses
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    due_day INTEGER,
    start_date DATE,
    end_date DATE,
    selected_months INTEGER[],
    selected_year INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_paid BOOLEAN DEFAULT false,
    payment_date DATE,
    payment_bank_account TEXT,
    receipt_path TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: recurring_expense_monthly_payments
CREATE TABLE IF NOT EXISTS public.recurring_expense_monthly_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
    payment_month INTEGER NOT NULL,
    payment_year INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount NUMERIC NOT NULL DEFAULT 0,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    receipt_path TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: recurring_expense_payment_plans
CREATE TABLE IF NOT EXISTS public.recurring_expense_payment_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    planned_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned'::text,
    notes TEXT,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: saved_bank_accounts
CREATE TABLE IF NOT EXISTS public.saved_bank_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    bank_name TEXT,
    account_holder TEXT,
    account_number TEXT,
    account_agency TEXT,
    account_document TEXT,
    pix_key TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em saved_signatures
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_signatures' AND column_name = 'signature_type') THEN
        ALTER TABLE public.saved_signatures ADD COLUMN signature_type TEXT NOT NULL DEFAULT 'company'::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_signatures' AND column_name = 'created_by') THEN
        ALTER TABLE public.saved_signatures ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Tabela: user_theme_preferences
CREATE TABLE IF NOT EXISTS public.user_theme_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    theme TEXT NOT NULL DEFAULT 'dark'::text,
    color_scheme TEXT NOT NULL DEFAULT 'blue'::text,
    custom_colors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela: workers
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    pix_key TEXT,
    image_url TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas extras em daily_rates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_rates' AND column_name = 'created_by') THEN
        ALTER TABLE public.daily_rates ADD COLUMN created_by UUID;
    END IF;
END$$;

-- Tabela: worker_expense_advances
CREATE TABLE IF NOT EXISTS public.worker_expense_advances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    receipt_url TEXT,
    is_finalized BOOLEAN NOT NULL DEFAULT false,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: whatsapp_expenses
CREATE TABLE IF NOT EXISTS public.whatsapp_expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT,
    sender TEXT,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    expense_date DATE,
    bank_account TEXT,
    event_id UUID REFERENCES public.events(id),
    status TEXT DEFAULT 'pending'::text,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- FUNÇÕES
-- =====================================================

-- Função: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Função: calculate_balance_from_transactions
CREATE OR REPLACE FUNCTION public.calculate_balance_from_transactions(account_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    total_income DECIMAL(10,2) := 0;
    total_expenses DECIMAL(10,2) := 0;
    final_balance DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_income
    FROM public.bank_transactions 
    WHERE bank_account_id = account_id_param 
    AND transaction_type = 'income';
    
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM public.bank_transactions 
    WHERE bank_account_id = account_id_param 
    AND transaction_type = 'expense';
    
    final_balance := total_income - total_expenses;
    
    RETURN final_balance;
END;
$function$;

-- Função: auto_update_account_balance_on_transaction
CREATE OR REPLACE FUNCTION public.auto_update_account_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    affected_account_id UUID;
    calculated_balance DECIMAL(10,2);
BEGIN
    affected_account_id := COALESCE(NEW.bank_account_id, OLD.bank_account_id);
    
    SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
    INTO calculated_balance
    FROM public.bank_transactions 
    WHERE bank_account_id = affected_account_id;
    
    UPDATE public.bank_accounts 
    SET balance = calculated_balance,
        current_balance = calculated_balance,
        updated_at = now()
    WHERE id = affected_account_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Função: update_event_totals
CREATE OR REPLACE FUNCTION public.update_event_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.events
  SET 
    total_expenses = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.event_expenses
      WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    ),
    profit_margin = total_budget - (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.event_expenses
      WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Função: update_equipment_stock
CREATE OR REPLACE FUNCTION public.update_equipment_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    equipment_name_to_update TEXT;
    equipment_record RECORD;
    total_rented INTEGER;
    total_returned INTEGER;
    total_maintenance INTEGER;
    net_rented INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        equipment_name_to_update := OLD.equipment_name;
    ELSE
        equipment_name_to_update := NEW.equipment_name;
    END IF;
    
    SELECT id, total_stock, name 
    INTO equipment_record
    FROM public.equipment 
    WHERE name = equipment_name_to_update
    LIMIT 1;
    
    IF equipment_record.id IS NOT NULL THEN
        SELECT COALESCE(SUM(quantity), 0) INTO total_rented
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('confirmed', 'active', 'pending', 'allocated');
        
        SELECT COALESCE(SUM(quantity), 0) INTO total_returned
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status = 'returned';
        
        SELECT COALESCE(SUM(quantity), 0) INTO total_maintenance
        FROM public.maintenance_records
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('agendada', 'em_andamento');
        
        net_rented := GREATEST(0, total_rented - total_returned);
        
        UPDATE public.equipment 
        SET 
            rented = net_rented,
            available = equipment_record.total_stock - net_rented - total_maintenance,
            status = CASE 
                WHEN equipment_record.total_stock - net_rented - total_maintenance <= 0 THEN 'out_of_stock'
                WHEN equipment_record.total_stock - net_rented - total_maintenance <= equipment_record.total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_record.id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Função: return_equipment_on_event_completion
CREATE OR REPLACE FUNCTION public.return_equipment_on_event_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.event_equipment 
        SET 
            status = 'returned',
            updated_at = now()
        WHERE event_id = NEW.id 
        AND status IN ('confirmed', 'active', 'pending');
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Função: create_event_expense_from_daily_rate
CREATE OR REPLACE FUNCTION public.create_event_expense_from_daily_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.event_expenses
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
    
    IF existing_count = 0 THEN
      INSERT INTO public.event_expenses (
        event_id, category, description, quantity, unit_price,
        total_price, expense_date, reference_type, reference_id, created_by
      ) VALUES (
        NEW.event_id, 'Diárias', 'Diária - ' || NEW.worker_name, 1,
        NEW.amount, NEW.amount, NEW.date, 'daily_rate', NEW.id, NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Função: delete_event_expense_from_daily_rate
CREATE OR REPLACE FUNCTION public.delete_event_expense_from_daily_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.event_expenses
  WHERE reference_type = 'daily_rate' AND reference_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Função: create_event_collaborator_from_daily_rate
CREATE OR REPLACE FUNCTION public.create_event_collaborator_from_daily_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.event_collaborators
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
    
    IF existing_count = 0 THEN
      INSERT INTO public.event_collaborators (
        event_id, collaborator_name, collaborator_email, role,
        reference_type, reference_id, assigned_by
      ) VALUES (
        NEW.event_id, NEW.worker_name, '', 'diarista',
        'daily_rate', NEW.id, NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Função: delete_event_collaborator_from_daily_rate
CREATE OR REPLACE FUNCTION public.delete_event_collaborator_from_daily_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.event_collaborators
  WHERE reference_type = 'daily_rate' AND reference_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Função: create_bank_transaction_for_advance
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.bank_transactions (
    bank_account_id, description, amount, transaction_type, category,
    reference_type, reference_id, transaction_date
  ) VALUES (
    NEW.bank_account_id, 'Adiantamento - ' || NEW.worker_name, NEW.amount,
    'expense', 'Adiantamentos de Diaristas', 'worker_advance', NEW.id, NEW.advance_date
  );
  RETURN NEW;
END;
$function$;

-- Função: delete_bank_transaction_for_advance
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'worker_advance' AND reference_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Função: create_bank_transaction_for_collaborator_vale
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_collaborator_vale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  collaborator_name_value TEXT;
BEGIN
  SELECT name INTO collaborator_name_value
  FROM public.collaborators
  WHERE id = NEW.collaborator_id;
  
  INSERT INTO public.bank_transactions (
    bank_account_id, description, amount, transaction_type, category,
    reference_type, reference_id, transaction_date
  ) VALUES (
    NEW.bank_account_id, 'Vale - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    NEW.amount, 'expense', 'Vales de Colaboradores', 'collaborator_vale', NEW.id, NEW.advance_date
  );
  RETURN NEW;
END;
$function$;

-- Função: delete_bank_transaction_for_collaborator_vale
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_collaborator_vale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'collaborator_vale' AND reference_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Triggers de updated_at
DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_cards_updated_at ON public.bank_cards;
CREATE TRIGGER update_bank_cards_updated_at BEFORE UPDATE ON public.bank_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_card_transactions_updated_at ON public.bank_card_transactions;
CREATE TRIGGER update_bank_card_transactions_updated_at BEFORE UPDATE ON public.bank_card_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_advances_updated_at ON public.client_advances;
CREATE TRIGGER update_client_advances_updated_at BEFORE UPDATE ON public.client_advances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_custom_items_updated_at ON public.client_custom_items;
CREATE TRIGGER update_client_custom_items_updated_at BEFORE UPDATE ON public.client_custom_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_collaborators_updated_at ON public.event_collaborators;
CREATE TRIGGER update_event_collaborators_updated_at BEFORE UPDATE ON public.event_collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_contracts_updated_at ON public.event_contracts;
CREATE TRIGGER update_event_contracts_updated_at BEFORE UPDATE ON public.event_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_equipment_updated_at ON public.event_equipment;
CREATE TRIGGER update_event_equipment_updated_at BEFORE UPDATE ON public.event_equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interstate_transports_updated_at ON public.interstate_transports;
CREATE TRIGGER update_interstate_transports_updated_at BEFORE UPDATE ON public.interstate_transports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_expense_monthly_payments_updated_at ON public.recurring_expense_monthly_payments;
CREATE TRIGGER update_recurring_expense_monthly_payments_updated_at BEFORE UPDATE ON public.recurring_expense_monthly_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_bank_accounts_updated_at ON public.saved_bank_accounts;
CREATE TRIGGER update_saved_bank_accounts_updated_at BEFORE UPDATE ON public.saved_bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON public.workers;
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_expense_advances_updated_at ON public.worker_expense_advances;
CREATE TRIGGER update_worker_expense_advances_updated_at BEFORE UPDATE ON public.worker_expense_advances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_expenses_updated_at ON public.whatsapp_expenses;
CREATE TRIGGER update_whatsapp_expenses_updated_at BEFORE UPDATE ON public.whatsapp_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers de sincronização de transações bancárias
DROP TRIGGER IF EXISTS auto_update_balance_on_transaction ON public.bank_transactions;
CREATE TRIGGER auto_update_balance_on_transaction AFTER INSERT OR DELETE OR UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION auto_update_account_balance_on_transaction();

-- Triggers de diárias
DROP TRIGGER IF EXISTS create_event_expense_from_daily_rate_trigger ON public.daily_rates;
CREATE TRIGGER create_event_expense_from_daily_rate_trigger AFTER INSERT ON public.daily_rates FOR EACH ROW EXECUTE FUNCTION create_event_expense_from_daily_rate();

DROP TRIGGER IF EXISTS delete_event_expense_from_daily_rate_trigger ON public.daily_rates;
CREATE TRIGGER delete_event_expense_from_daily_rate_trigger AFTER DELETE ON public.daily_rates FOR EACH ROW EXECUTE FUNCTION delete_event_expense_from_daily_rate();

DROP TRIGGER IF EXISTS create_event_collaborator_from_daily_rate_trigger ON public.daily_rates;
CREATE TRIGGER create_event_collaborator_from_daily_rate_trigger AFTER INSERT ON public.daily_rates FOR EACH ROW EXECUTE FUNCTION create_event_collaborator_from_daily_rate();

DROP TRIGGER IF EXISTS delete_event_collaborator_from_daily_rate_trigger ON public.daily_rates;
CREATE TRIGGER delete_event_collaborator_from_daily_rate_trigger AFTER DELETE ON public.daily_rates FOR EACH ROW EXECUTE FUNCTION delete_event_collaborator_from_daily_rate();

-- Triggers de adiantamentos
DROP TRIGGER IF EXISTS create_worker_advance_transaction ON public.worker_expense_advances;
CREATE TRIGGER create_worker_advance_transaction AFTER INSERT ON public.worker_expense_advances FOR EACH ROW EXECUTE FUNCTION create_bank_transaction_for_advance();

DROP TRIGGER IF EXISTS delete_worker_advance_transaction ON public.worker_expense_advances;
CREATE TRIGGER delete_worker_advance_transaction AFTER DELETE ON public.worker_expense_advances FOR EACH ROW EXECUTE FUNCTION delete_bank_transaction_for_advance();

DROP TRIGGER IF EXISTS create_collaborator_vale_transaction ON public.collaborator_advances;
CREATE TRIGGER create_collaborator_vale_transaction AFTER INSERT ON public.collaborator_advances FOR EACH ROW EXECUTE FUNCTION create_bank_transaction_for_collaborator_vale();

DROP TRIGGER IF EXISTS delete_collaborator_vale_transaction ON public.collaborator_advances;
CREATE TRIGGER delete_collaborator_vale_transaction AFTER DELETE ON public.collaborator_advances FOR EACH ROW EXECUTE FUNCTION delete_bank_transaction_for_collaborator_vale();

-- Triggers de equipamentos
DROP TRIGGER IF EXISTS update_equipment_stock_trigger ON public.event_equipment;
CREATE TRIGGER update_equipment_stock_trigger AFTER INSERT OR UPDATE OR DELETE ON public.event_equipment FOR EACH ROW EXECUTE FUNCTION update_equipment_stock();

DROP TRIGGER IF EXISTS return_equipment_on_completion ON public.events;
CREATE TRIGGER return_equipment_on_completion AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION return_equipment_on_event_completion();

-- Triggers de despesas de eventos
DROP TRIGGER IF EXISTS update_event_totals_trigger ON public.event_expenses;
CREATE TRIGGER update_event_totals_trigger AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses FOR EACH ROW EXECUTE FUNCTION update_event_totals();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_custom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_expense_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_monthly_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_fixed_expense_monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interstate_transports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_expense_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_expenses ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Allow all access" ON public.approval_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.bank_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.bank_card_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.client_custom_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.collaborator_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.collaborator_expense_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.collaborator_monthly_salaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.company_fixed_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.company_fixed_expense_monthly_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.contract_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.event_collaborators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.event_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.event_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.interstate_transports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.recurring_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.recurring_expense_monthly_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.recurring_expense_payment_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.saved_bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.user_theme_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.worker_expense_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.whatsapp_expenses FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('budget-pdfs', 'budget-pdfs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('company_files', 'company_files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('worker-photos', 'worker-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('worker-receipts', 'worker-receipts', true) ON CONFLICT (id) DO NOTHING;