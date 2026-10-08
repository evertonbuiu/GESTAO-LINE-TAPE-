-- Esquema gerado automaticamente por cloudflare/tools/gen_d1_schema.py
-- a partir das migrações do Supabase. Não edite à mão.
PRAGMA foreign_keys = ON;

-- Usuários (substitui auth.users do Supabase)
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  raw_user_meta_data TEXT NOT NULL DEFAULT '{}',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  last_sign_in_at TEXT
);
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
-- Contexto da requisição (usuário atual) lido pelas regras automáticas
CREATE TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v TEXT);
-- Controle de alterações para atualização automática das telas
-- Sequências (antes: CREATE SEQUENCE no PostgreSQL)
CREATE TABLE IF NOT EXISTS _sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS _changes (tbl TEXT PRIMARY KEY, version INTEGER NOT NULL, changed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS storage_objects (
  bucket_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  owner TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  PRIMARY KEY (bucket_id, name)
);

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_credentials" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_role_check" CHECK (role IN ('admin', 'funcionario', 'financeiro', 'deposito')),
  CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role")
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "permissions_name_key" UNIQUE ("name")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "role" TEXT NOT NULL,
  "permission_id" TEXT,
  "can_view" INTEGER DEFAULT 0,
  "can_edit" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_role_permission_id_key" UNIQUE ("role", "permission_id")
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "client_name" TEXT,
  "client_email" TEXT,
  "client_phone" TEXT,
  "setup_start_date" TEXT,
  "event_date" TEXT NOT NULL,
  "event_time" TEXT,
  "location" TEXT,
  "description" TEXT,
  "total_budget" REAL DEFAULT 0,
  "total_expenses" REAL DEFAULT 0,
  "profit_margin" REAL DEFAULT 0,
  "status" TEXT DEFAULT 'pending',
  "is_paid" INTEGER DEFAULT 0,
  "payment_date" TEXT,
  "payment_bank_account" TEXT,
  "payment_amount" REAL DEFAULT 0,
  "payment_type" TEXT,
  "remaining_payment_amount" REAL DEFAULT 0,
  "remaining_payment_date" TEXT,
  "remaining_payment_bank_account" TEXT,
  "is_remaining_paid" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "created_by" TEXT
);

CREATE TABLE IF NOT EXISTS "event_expenses" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT,
  "category" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER DEFAULT 1,
  "unit_price" REAL DEFAULT 0,
  "total_price" REAL DEFAULT 0,
  "supplier" TEXT,
  "notes" TEXT,
  "receipt_url" TEXT,
  "expense_bank_account" TEXT,
  "expense_date" TEXT,
  "payment_date" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "payment_bank_account" TEXT,
  "is_paid" INTEGER DEFAULT 0,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "is_finalized" INTEGER NOT NULL DEFAULT 0,
  "created_by" TEXT,
  CONSTRAINT "event_expenses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "event_equipment" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "equipment_name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "assigned_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "budget_pdf_url" TEXT,
  "image_url" TEXT,
  CONSTRAINT "event_equipment_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "equipment" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "total_stock" INTEGER DEFAULT 0,
  "available" INTEGER DEFAULT 0,
  "rented" INTEGER DEFAULT 0,
  "price_per_day" REAL DEFAULT 0,
  "status" TEXT DEFAULT 'available',
  "image_url" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "budget_pdf_url" TEXT,
  "min_stock" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "event_collaborators" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "collaborator_name" TEXT NOT NULL,
  "collaborator_email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'funcionario',
  "assigned_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "reference_type" TEXT,
  "reference_id" TEXT,
  "collaborator_id" TEXT,
  "worker_id" TEXT,
  "person_type" TEXT,
  CONSTRAINT "event_collaborators_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE,
  CONSTRAINT "event_collaborators_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE SET NULL,
  CONSTRAINT "event_collaborators_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "bank_name" TEXT,
  "account_number" TEXT,
  "agency" TEXT,
  "account_type" TEXT,
  "initial_balance" REAL DEFAULT 0,
  "current_balance" REAL DEFAULT 0,
  "is_active" INTEGER DEFAULT 1,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "balance" REAL DEFAULT 0.00,
  "pluggy_item_id" TEXT,
  "pluggy_account_id" TEXT
);

CREATE TABLE IF NOT EXISTS "bank_transactions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "bank_account_id" TEXT,
  "transaction_date" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "transaction_type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "balance_after" REAL,
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "reference_type" TEXT,
  "reference_id" TEXT,
  "receipt_url" TEXT,
  "pluggy_transaction_id" TEXT,
  "import_fingerprint" TEXT,
  "transaction_time" TEXT,
  CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE CASCADE,
  CONSTRAINT "bank_transactions_transaction_type_check" CHECK (transaction_type IN ('income', 'expense'))
);

CREATE TABLE IF NOT EXISTS "company_settings" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "company_name" TEXT,
  "tagline" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "cnpj" TEXT,
  "website" TEXT,
  "logo_url" TEXT,
  "primary_color" TEXT,
  "secondary_color" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "user_credentials" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" INTEGER DEFAULT 1,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "password_salt" TEXT,
  "last_login" TEXT,
  CONSTRAINT "user_credentials_username_key" UNIQUE ("username")
);

CREATE TABLE IF NOT EXISTS "user_theme_preferences" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'dark',
  "color_scheme" TEXT NOT NULL DEFAULT 'blue',
  "custom_colors" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "mode" TEXT NOT NULL DEFAULT 'system',
  "primary_hsl" TEXT,
  "density" TEXT NOT NULL DEFAULT 'comfortable',
  "font_scale" REAL NOT NULL DEFAULT 1,
  "radius_scale" REAL NOT NULL DEFAULT 1,
  "reduced_motion" INTEGER NOT NULL DEFAULT 0,
  "high_contrast" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "unique_user_theme_preferences" UNIQUE ("user_id"),
  CONSTRAINT "utp_mode_check" CHECK (mode IN ('light','dark','system')),
  CONSTRAINT "utp_density_check" CHECK (density IN ('compact','comfortable')),
  CONSTRAINT "utp_font_scale_check" CHECK (font_scale >= 0.85 AND font_scale <= 1.30),
  CONSTRAINT "utp_radius_scale_check" CHECK (radius_scale >= 0 AND radius_scale <= 2),
  CONSTRAINT "user_theme_preferences_user_id_key" UNIQUE ("user_id")
);

CREATE TABLE IF NOT EXISTS "collaborators" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT,
  "status" TEXT DEFAULT 'active',
  "pix_key" TEXT,
  "bank_account" TEXT,
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "created_by" TEXT,
  "social_name" TEXT,
  "birth_date" TEXT,
  "whatsapp" TEXT,
  "address_street" TEXT,
  "address_number" TEXT,
  "address_complement" TEXT,
  "address_district" TEXT,
  "address_city" TEXT,
  "address_state" TEXT,
  "address_zip" TEXT,
  "emergency_contact_name" TEXT,
  "emergency_contact_phone" TEXT,
  "secondary_roles" TEXT NOT NULL DEFAULT '[]',
  "skills" TEXT NOT NULL DEFAULT '[]',
  "uniform_size" TEXT,
  "shoe_size" TEXT,
  "internal_notes" TEXT,
  "photo_url" TEXT,
  "employment_type" TEXT NOT NULL DEFAULT 'fixo',
  "status_reason" TEXT,
  "default_daily_rate" REAL
);

CREATE TABLE IF NOT EXISTS "maintenance_records" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "equipment_id" TEXT,
  "equipment_name" TEXT NOT NULL,
  "maintenance_type" TEXT NOT NULL,
  "status" TEXT DEFAULT 'agendada',
  "priority" TEXT DEFAULT 'normal',
  "scheduled_date" TEXT NOT NULL,
  "completed_date" TEXT,
  "description" TEXT NOT NULL,
  "problem_description" TEXT,
  "solution_description" TEXT,
  "cost" REAL DEFAULT 0,
  "quantity" INTEGER DEFAULT 1,
  "technician_name" TEXT,
  "technician_contact" TEXT,
  "created_by" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "maintenance_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "patrimony_inventory" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "quantity" INTEGER DEFAULT 1,
  "acquisition_value" REAL DEFAULT 0,
  "current_value" REAL DEFAULT 0,
  "acquisition_date" TEXT,
  "condition" TEXT,
  "location" TEXT,
  "serial_number" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "interstate_transports" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "destination" TEXT NOT NULL,
  "transport_date" TEXT NOT NULL,
  "driver_name" TEXT NOT NULL,
  "vehicle_plate" TEXT NOT NULL,
  "equipment_list" TEXT DEFAULT '[]',
  "total_weight" REAL DEFAULT 0,
  "estimated_cost" REAL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "origin_state" TEXT,
  "driver_cpf" TEXT,
  "cargo_type" TEXT,
  "cargo_weight" REAL DEFAULT 0,
  "cargo_value" REAL DEFAULT 0,
  "invoice_number" TEXT,
  "material_list" TEXT DEFAULT '[]',
  "return_status" TEXT DEFAULT 'pending',
  "return_date" TEXT,
  "return_notes" TEXT,
  "origin_city" TEXT,
  "destination_state" TEXT,
  "departure_time" TEXT,
  "arrival_date" TEXT,
  "arrival_time" TEXT,
  "expected_return_date" TEXT,
  "distance_km" REAL NOT NULL DEFAULT 0,
  "legs" TEXT NOT NULL DEFAULT '[]',
  "vehicle_model" TEXT,
  "vehicle_capacity_kg" REAL,
  "driver_phone" TEXT,
  "helpers" TEXT NOT NULL DEFAULT '[]',
  "event_id" TEXT,
  "fuel_consumption_kmpl" REAL NOT NULL DEFAULT 0,
  "fuel_price_cents" INTEGER NOT NULL DEFAULT 0,
  "fuel_cost_cents" INTEGER NOT NULL DEFAULT 0,
  "toll_cents" INTEGER NOT NULL DEFAULT 0,
  "lodging_cents" INTEGER NOT NULL DEFAULT 0,
  "meals_cents" INTEGER NOT NULL DEFAULT 0,
  "daily_rate_cents" INTEGER NOT NULL DEFAULT 0,
  "maintenance_cents" INTEGER NOT NULL DEFAULT 0,
  "freight_cents" INTEGER NOT NULL DEFAULT 0,
  "advance_cents" INTEGER NOT NULL DEFAULT 0,
  "extra_cents" INTEGER NOT NULL DEFAULT 0,
  "revenue_cents" INTEGER NOT NULL DEFAULT 0,
  "receipt_path" TEXT,
  "cancel_reason" TEXT,
  "cancelled_at" TEXT,
  "completed_at" TEXT,
  CONSTRAINT "interstate_transports_status_check" CHECK (status IN ('planned', 'in_transit', 'delivered', 'cancelled')),
  CONSTRAINT "interstate_transports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "recurring_expenses" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "description" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "is_paid" INTEGER DEFAULT 0,
  "payment_date" TEXT,
  "payment_bank_account" TEXT,
  "start_date" TEXT,
  "end_date" TEXT,
  "selected_months" TEXT,
  "selected_year" INTEGER,
  "due_day" INTEGER,
  "receipt_path" TEXT,
  CONSTRAINT "due_day_range" CHECK (due_day >= 1 AND due_day <= 31)
);

CREATE TABLE IF NOT EXISTS "recurring_expense_payment_plans" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "recurring_expense_id" TEXT NOT NULL,
  "planned_date" TEXT NOT NULL,
  "planned_amount" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "notes" TEXT,
  "bank_account_id" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "recurring_expense_payment_plans_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses" ("id") ON DELETE CASCADE,
  CONSTRAINT "recurring_expense_payment_plans_status_check" CHECK (status IN ('planned', 'paid', 'cancelled')),
  CONSTRAINT "recurring_expense_payment_plans_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);

CREATE TABLE IF NOT EXISTS "recurring_expense_monthly_payments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "recurring_expense_id" TEXT NOT NULL,
  "payment_month" INTEGER NOT NULL,
  "payment_year" INTEGER NOT NULL,
  "payment_date" TEXT NOT NULL,
  "payment_amount" REAL NOT NULL DEFAULT 0,
  "bank_account_id" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "receipt_path" TEXT,
  CONSTRAINT "recurring_expense_monthly_payments_payment_month_check" CHECK (payment_month >= 1 AND payment_month <= 12),
  CONSTRAINT "recurring_expense_monthly_payments_payment_year_check" CHECK (payment_year >= 2020),
  CONSTRAINT "recurring_expense_monthly_payments_recurring_expense_id_payment_month_payment_year_key" UNIQUE ("recurring_expense_id", "payment_month", "payment_year")
);

CREATE TABLE IF NOT EXISTS "event_budgets" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT,
  "item" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER DEFAULT 1,
  "unit_price" REAL DEFAULT 0,
  "total_price" REAL DEFAULT 0,
  "image_url" TEXT,
  "created_by" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "pdf_url" TEXT,
  "source_item_id" TEXT,
  CONSTRAINT "event_budgets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "bank_cards" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "card_number" TEXT NOT NULL,
  "card_type" TEXT NOT NULL,
  "bank" TEXT NOT NULL,
  "limit_amount" REAL,
  "current_balance" REAL NOT NULL DEFAULT 0,
  "available_limit" REAL,
  "due_date" INTEGER,
  "closing_date" INTEGER,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "bank_cards_card_type_check" CHECK (card_type IN ('credit', 'debit'))
);

CREATE TABLE IF NOT EXISTS "contracts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "contract_number" TEXT NOT NULL,
  "client_name" TEXT NOT NULL,
  "client_email" TEXT,
  "client_phone" TEXT,
  "client_document" TEXT,
  "service_description" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "total_value" REAL DEFAULT 0,
  "payment_terms" TEXT,
  "status" TEXT DEFAULT 'draft',
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "created_by" TEXT,
  "template_id" TEXT,
  "template_version" INTEGER,
  "template_name" TEXT,
  "sections_snapshot" TEXT,
  "details" TEXT,
  "client_id" TEXT,
  "event_id" TEXT,
  "quote_id" TEXT,
  "source_quote_number" TEXT,
  "sent_at" TEXT,
  "signed_at" TEXT,
  "cancelled_at" TEXT,
  "locked" INTEGER NOT NULL DEFAULT 0,
  "updated_by" TEXT,
  CONSTRAINT "contracts_contract_number_key" UNIQUE ("contract_number"),
  CONSTRAINT "contracts_status_check" CHECK (status IN ( 'draft', 'active', 'completed', 'cancelled', 'rascunho', 'revisao', 'enviado', 'assinado', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS "contract_attachments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "contract_id" TEXT,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" TEXT,
  "file_size" INTEGER,
  "uploaded_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "contract_attachments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts" ("id") ON DELETE CASCADE,
  CONSTRAINT "contract_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth_users" ("id")
);

CREATE TABLE IF NOT EXISTS "contract_payments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "contract_id" TEXT,
  "payment_date" TEXT NOT NULL,
  "payment_amount" REAL NOT NULL,
  "payment_method" TEXT,
  "payment_status" TEXT DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "contract_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts" ("id") ON DELETE CASCADE,
  CONSTRAINT "contract_payments_payment_status_check" CHECK (payment_status IN ('pending', 'paid', 'overdue'))
);

CREATE TABLE IF NOT EXISTS "external_quotes" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT,
  "quote_number" TEXT,
  "supplier_name" TEXT,
  "description" TEXT,
  "items" TEXT,
  "total_value" REAL DEFAULT 0,
  "status" TEXT DEFAULT 'pending',
  "valid_until" TEXT,
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "client_name" TEXT,
  "client_email" TEXT,
  "client_phone" TEXT,
  "client_document" TEXT,
  "client_address" TEXT,
  "event_name" TEXT,
  "event_location" TEXT,
  "event_date" TEXT,
  "initial_setup_date" TEXT,
  "decorator_name" TEXT,
  "technical_responsible" TEXT,
  "quote_date" TEXT NOT NULL DEFAULT (date('now')),
  "products" TEXT DEFAULT '[]',
  "subtotal" REAL NOT NULL DEFAULT 0,
  "discount_percentage" REAL DEFAULT 0,
  "discount_amount" REAL DEFAULT 0,
  "travel_expense" REAL DEFAULT 0,
  "accommodation_expense" REAL DEFAULT 0,
  "tax_option" TEXT DEFAULT 'sem_nota',
  "total_amount" REAL NOT NULL DEFAULT 0,
  "created_by" TEXT,
  "tax_percentage" REAL DEFAULT 15,
  "tax_amount" REAL DEFAULT 0,
  CONSTRAINT "external_quotes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "saved_signatures" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "signature_data" TEXT NOT NULL,
  "user_id" TEXT,
  "is_default" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "signature_type" TEXT NOT NULL DEFAULT 'company',
  "created_by" TEXT
);

CREATE TABLE IF NOT EXISTS "bank_card_transactions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "card_id" TEXT NOT NULL,
  "transaction_date" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "category" TEXT,
  "transaction_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "bank_card_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "bank_cards" ("id") ON DELETE CASCADE,
  CONSTRAINT "bank_card_transactions_transaction_type_check" CHECK (transaction_type IN ('credit', 'debit'))
);

CREATE TABLE IF NOT EXISTS "daily_rates" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "worker_name" TEXT NOT NULL,
  "event_id" TEXT,
  "date" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "bank_account_id" TEXT,
  "is_finalized" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "created_by" TEXT,
  "worker_id" TEXT,
  "event_role" TEXT,
  "planned_start_time" TEXT,
  "planned_end_time" TEXT,
  "actual_start_time" TEXT,
  "actual_end_time" TEXT,
  "attendance_status" TEXT NOT NULL DEFAULT 'prevista',
  "substituted_worker_name" TEXT,
  "overtime_amount" REAL NOT NULL DEFAULT 0,
  "food_amount" REAL NOT NULL DEFAULT 0,
  "transport_amount" REAL NOT NULL DEFAULT 0,
  "lodging_amount" REAL NOT NULL DEFAULT 0,
  "discount_amount" REAL NOT NULL DEFAULT 0,
  "payment_status" TEXT NOT NULL DEFAULT 'pendente',
  "payment_method" TEXT,
  "receipt_url" TEXT,
  CONSTRAINT "daily_rates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL,
  CONSTRAINT "daily_rates_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL,
  CONSTRAINT "daily_rates_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "worker_advances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "worker_name" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "advance_date" TEXT NOT NULL DEFAULT (date('now')),
  "notes" TEXT,
  "bank_account_id" TEXT,
  "is_finalized" INTEGER DEFAULT 0,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "worker_advances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);

CREATE TABLE IF NOT EXISTS "workers" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "image_url" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "social_name" TEXT,
  "email" TEXT,
  "birth_date" TEXT,
  "whatsapp" TEXT,
  "address_street" TEXT,
  "address_number" TEXT,
  "address_complement" TEXT,
  "address_district" TEXT,
  "address_city" TEXT,
  "address_state" TEXT,
  "address_zip" TEXT,
  "emergency_contact_name" TEXT,
  "emergency_contact_phone" TEXT,
  "primary_role" TEXT,
  "secondary_roles" TEXT NOT NULL DEFAULT '[]',
  "skills" TEXT NOT NULL DEFAULT '[]',
  "uniform_size" TEXT,
  "shoe_size" TEXT,
  "internal_notes" TEXT,
  "notes" TEXT,
  "employment_type" TEXT NOT NULL DEFAULT 'diarista',
  "status" TEXT NOT NULL DEFAULT 'ativo',
  "status_reason" TEXT,
  "default_daily_rate" REAL,
  "phone" TEXT,
  "pix_key" TEXT
);

CREATE TABLE IF NOT EXISTS "collaborator_payments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "collaborator_id" TEXT,
  "event_id" TEXT,
  "payment_date" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "payment_method" TEXT,
  "bank_account_id" TEXT,
  "notes" TEXT,
  "is_paid" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "collaborator_payments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE CASCADE,
  CONSTRAINT "collaborator_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL,
  CONSTRAINT "collaborator_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "collaborator_advances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "collaborator_id" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "advance_date" TEXT NOT NULL DEFAULT (date('now')),
  "bank_account_id" TEXT NOT NULL,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "collaborator_advances_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE CASCADE,
  CONSTRAINT "collaborator_advances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "collaborator_monthly_salaries" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "collaborator_id" TEXT NOT NULL,
  "salary_month" INTEGER NOT NULL,
  "salary_year" INTEGER NOT NULL,
  "salary_amount" REAL NOT NULL DEFAULT 0,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "is_paid" INTEGER NOT NULL DEFAULT 0,
  "payment_date" TEXT,
  "bank_account_id" TEXT,
  CONSTRAINT "collaborator_monthly_salaries_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE CASCADE,
  CONSTRAINT "collaborator_monthly_salaries_salary_month_check" CHECK (salary_month >= 0 AND salary_month <= 11),
  CONSTRAINT "collaborator_monthly_salaries_collaborator_id_salary_month_salary_year_key" UNIQUE ("collaborator_id", "salary_month", "salary_year"),
  CONSTRAINT "collaborator_monthly_salaries_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);

CREATE TABLE IF NOT EXISTS "worker_expense_advances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "worker_name" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "advance_date" TEXT NOT NULL DEFAULT (date('now')),
  "bank_account_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "is_finalized" INTEGER NOT NULL DEFAULT 0,
  "receipt_url" TEXT,
  CONSTRAINT "worker_expense_advances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);

CREATE TABLE IF NOT EXISTS "collaborator_expense_advances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "collaborator_id" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "advance_date" TEXT NOT NULL DEFAULT (date('now')),
  "bank_account_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "collaborator_expense_advances_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE CASCADE,
  CONSTRAINT "collaborator_expense_advances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "client_advances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "client_id" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "advance_date" TEXT NOT NULL DEFAULT (date('now')),
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "client_advances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "client_custom_items" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "client_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" REAL NOT NULL DEFAULT 0,
  "total_price" REAL NOT NULL DEFAULT 0,
  "fabrication_date" TEXT NOT NULL DEFAULT (date('now')),
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "client_custom_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "saved_bank_accounts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "bank_name" TEXT,
  "account_holder" TEXT,
  "account_number" TEXT,
  "account_agency" TEXT,
  "account_document" TEXT,
  "pix_key" TEXT,
  "is_default" INTEGER DEFAULT 0,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "company_expenses" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "category" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER DEFAULT 1,
  "unit_price" REAL DEFAULT 0,
  "total_price" REAL DEFAULT 0,
  "supplier" TEXT,
  "notes" TEXT,
  "receipt_url" TEXT,
  "expense_bank_account" TEXT,
  "payment_bank_account" TEXT,
  "expense_date" TEXT,
  "payment_date" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "is_paid" INTEGER DEFAULT 0,
  "created_by" TEXT
);

CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "permission_id" TEXT,
  "can_view" INTEGER DEFAULT 0,
  "can_edit" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_credentials" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_permissions_user_id_permission_id_key" UNIQUE ("user_id", "permission_id")
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "requested_by" TEXT NOT NULL,
  "requested_operation" TEXT NOT NULL,
  "operation_details" TEXT NOT NULL,
  "target_resource_type" TEXT NOT NULL,
  "target_resource_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approved_by" TEXT,
  "approval_reason" TEXT,
  "rejection_reason" TEXT,
  "expires_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now','+7 days')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "old_values" TEXT,
  "new_values" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "success" INTEGER NOT NULL DEFAULT 1,
  "error_message" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "company_fixed_expenses" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "category" TEXT NOT NULL,
  "monthly_amount" REAL NOT NULL DEFAULT 0,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "company_fixed_expense_monthly_payments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "company_fixed_expense_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "payment_month" INTEGER NOT NULL,
  "payment_year" INTEGER NOT NULL,
  "payment_date" TEXT NOT NULL,
  "payment_amount" REAL NOT NULL DEFAULT 0,
  "bank_account_id" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "company_fixed_expense_monthly_payments_company_fixed_expense_id_fkey" FOREIGN KEY ("company_fixed_expense_id") REFERENCES "company_fixed_expenses" ("id") ON DELETE CASCADE,
  CONSTRAINT "company_fixed_expense_monthly_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);

CREATE TABLE IF NOT EXISTS "event_contracts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT,
  "contract_number" TEXT NOT NULL,
  "budget_number" TEXT,
  "company_name" TEXT NOT NULL DEFAULT 'Luz Locação',
  "company_address" TEXT,
  "company_phone" TEXT,
  "company_email" TEXT,
  "company_document" TEXT,
  "client_name" TEXT NOT NULL,
  "client_email" TEXT,
  "client_document" TEXT,
  "client_address" TEXT,
  "client_phone" TEXT,
  "event_date" TEXT,
  "event_location" TEXT,
  "initial_setup_date" TEXT,
  "decorator" TEXT,
  "technical_responsible" TEXT,
  "products" TEXT DEFAULT '[]',
  "subtotal" REAL DEFAULT 0,
  "discount" REAL DEFAULT 0,
  "discount_rate" REAL DEFAULT 0,
  "with_discount" INTEGER DEFAULT 0,
  "tax" REAL DEFAULT 0,
  "tax_rate" REAL DEFAULT 15,
  "with_tax" INTEGER DEFAULT 0,
  "total" REAL DEFAULT 0,
  "service_description" TEXT,
  "payment_terms" TEXT,
  "delivery_terms" TEXT,
  "cancellation_policy" TEXT,
  "warranty_terms" TEXT,
  "additional_terms" TEXT,
  "company_signature" TEXT,
  "client_signature" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "signed_at" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "event_contracts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "collaborator_food_allowances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "collaborator_id" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "allowance_date" TEXT NOT NULL DEFAULT (date('now')),
  "bank_account_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "event_id" TEXT,
  "allowance_type" TEXT DEFAULT 'galpao',
  CONSTRAINT "collaborator_food_allowances_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators" ("id") ON DELETE CASCADE,
  CONSTRAINT "collaborator_food_allowances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id"),
  CONSTRAINT "collaborator_food_allowances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL,
  CONSTRAINT "collaborator_food_allowances_allowance_type_check" CHECK (allowance_type IN ('galpao', 'evento'))
);

CREATE TABLE IF NOT EXISTS "worker_food_allowances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "worker_name" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "allowance_date" TEXT NOT NULL DEFAULT (date('now')),
  "bank_account_id" TEXT,
  "event_id" TEXT,
  "allowance_type" TEXT DEFAULT 'galpao',
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "worker_food_allowances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id"),
  CONSTRAINT "worker_food_allowances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "sender_phone" TEXT NOT NULL,
  "sender_name" TEXT,
  "message_content" TEXT,
  "message_type" TEXT DEFAULT 'text',
  "attachment_url" TEXT,
  "attachment_type" TEXT,
  "event_id" TEXT,
  "event_expense_id" TEXT,
  "status" TEXT DEFAULT 'pending',
  "matched_event_name" TEXT,
  "extracted_amount" REAL,
  "extracted_description" TEXT,
  "processing_notes" TEXT,
  "received_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "processed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "extracted_date" TEXT,
  "extracted_time" TEXT,
  "extracted_name" TEXT,
  "extraction_status" TEXT NOT NULL DEFAULT 'not_applicable',
  "extraction_confidence" REAL,
  "company_expense_id" TEXT,
  "link_destination" TEXT,
  "person_type" TEXT,
  "person_id" TEXT,
  "person_name" TEXT,
  "linked_record_type" TEXT,
  "linked_record_id" TEXT,
  CONSTRAINT "whatsapp_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL,
  CONSTRAINT "whatsapp_messages_event_expense_id_fkey" FOREIGN KEY ("event_expense_id") REFERENCES "event_expenses" ("id") ON DELETE SET NULL,
  CONSTRAINT "whatsapp_messages_company_expense_id_fkey" FOREIGN KEY ("company_expense_id") REFERENCES "company_expenses" ("id") ON DELETE SET NULL,
  CONSTRAINT "whatsapp_messages_extraction_status_check" CHECK (extraction_status IN ('not_applicable', 'processing', 'completed', 'failed')),
  CONSTRAINT "whatsapp_messages_person_type_check" CHECK (person_type IS NULL OR person_type IN ('collaborator', 'worker')),
  CONSTRAINT "whatsapp_messages_link_destination_check" CHECK (link_destination IS NULL OR link_destination IN ( 'evento', 'galpao', 'collaborator', 'worker', 'fixed_expense', 'personal_expense' ))
);

CREATE TABLE IF NOT EXISTS "nfse_invoices" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "invoice_number" TEXT,
  "rps_number" TEXT NOT NULL,
  "rps_series" TEXT DEFAULT 'RPS',
  "rps_type" INTEGER DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'rps_generated',
  "issue_date" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "competence_date" TEXT NOT NULL DEFAULT (date('now')),
  "transmitted_at" TEXT,
  "authorized_at" TEXT,
  "cancelled_at" TEXT,
  "provider_cnpj" TEXT NOT NULL,
  "provider_im" TEXT,
  "provider_name" TEXT NOT NULL,
  "provider_address" TEXT,
  "provider_city_code" TEXT DEFAULT '5208707',
  "provider_state" TEXT DEFAULT 'GO',
  "taker_type" TEXT DEFAULT '2',
  "taker_document" TEXT NOT NULL,
  "taker_name" TEXT NOT NULL,
  "taker_email" TEXT,
  "taker_phone" TEXT,
  "taker_address" TEXT,
  "taker_city_code" TEXT,
  "taker_state" TEXT,
  "taker_cep" TEXT,
  "service_code" TEXT NOT NULL,
  "cnae_code" TEXT,
  "service_description" TEXT NOT NULL,
  "service_value" REAL NOT NULL,
  "deduction_value" REAL DEFAULT 0,
  "base_calculation" REAL NOT NULL,
  "iss_rate" REAL DEFAULT 5.00,
  "iss_value" REAL NOT NULL,
  "pis_value" REAL DEFAULT 0,
  "cofins_value" REAL DEFAULT 0,
  "inss_value" REAL DEFAULT 0,
  "ir_value" REAL DEFAULT 0,
  "csll_value" REAL DEFAULT 0,
  "other_retentions" REAL DEFAULT 0,
  "discount_unconditioned" REAL DEFAULT 0,
  "discount_conditioned" REAL DEFAULT 0,
  "net_value" REAL NOT NULL,
  "iss_retention" INTEGER DEFAULT 0,
  "iss_retention_responsible" INTEGER DEFAULT 1,
  "nature_operation" INTEGER DEFAULT 1,
  "special_regime" INTEGER DEFAULT 6,
  "simple_national" INTEGER DEFAULT 1,
  "cultural_incentive" INTEGER DEFAULT 0,
  "xml_rps" TEXT,
  "xml_nfse" TEXT,
  "protocol_number" TEXT,
  "verification_code" TEXT,
  "nfse_link" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "event_id" TEXT,
  "quote_id" TEXT,
  "contract_id" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "nfse_invoices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL,
  CONSTRAINT "nfse_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "external_quotes" ("id") ON DELETE SET NULL,
  CONSTRAINT "nfse_invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "event_contracts" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "nfse_certificates" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "certificate_name" TEXT NOT NULL,
  "certificate_type" TEXT DEFAULT 'A1',
  "valid_from" TEXT,
  "valid_until" TEXT,
  "issuer" TEXT,
  "subject_cn" TEXT,
  "is_active" INTEGER DEFAULT 1,
  "storage_path" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "nfse_config" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "municipality_code" TEXT NOT NULL DEFAULT '5208707',
  "municipality_name" TEXT DEFAULT 'Goiânia',
  "state" TEXT DEFAULT 'GO',
  "webservice_url" TEXT DEFAULT 'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
  "webservice_url_homolog" TEXT DEFAULT 'https://nfseh.goiania.go.gov.br/ws/nfse.asmx',
  "abrasf_version" TEXT DEFAULT '2.04',
  "environment" TEXT DEFAULT 'homologacao',
  "default_service_code" TEXT,
  "default_cnae" TEXT,
  "default_iss_rate" REAL DEFAULT 5.00,
  "last_rps_number" INTEGER DEFAULT 0,
  "rps_series" TEXT DEFAULT 'RPS',
  "active_certificate_id" TEXT,
  "is_configured" INTEGER DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "provider_cnpj" TEXT,
  "provider_im" TEXT,
  "simple_national" INTEGER NOT NULL DEFAULT 1,
  "iss_retention_default" INTEGER NOT NULL DEFAULT 0,
  "service_exigibility" INTEGER NOT NULL DEFAULT 1,
  "national_homologation_enabled" INTEGER NOT NULL DEFAULT 0,
  "national_transmission_enabled" INTEGER NOT NULL DEFAULT 0,
  "national_registration_status" TEXT NOT NULL DEFAULT 'nao_solicitado',
  "national_registration_confirmed_at" TEXT,
  CONSTRAINT "nfse_config_active_certificate_id_fkey" FOREIGN KEY ("active_certificate_id") REFERENCES "nfse_certificates" ("id"),
  CONSTRAINT "nfse_config_national_registration_status_check" CHECK (national_registration_status IN ('nao_solicitado', 'solicitado', 'aprovado', 'recusado'))
);

CREATE TABLE IF NOT EXISTS "app_error_logs" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "user_id" TEXT,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "route" TEXT,
  "context" TEXT NOT NULL DEFAULT '{}',
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "old_data" TEXT,
  "new_data" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "event_checklists" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "responsible_name" TEXT,
  "responsible_user_id" TEXT,
  "performed_at" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "event_checklists_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE,
  CONSTRAINT "event_checklists_phase_check" CHECK (phase IN ('separacao','saida','devolucao')),
  CONSTRAINT "event_checklists_status_check" CHECK (status IN ('pendente','em_andamento','concluido')),
  CONSTRAINT "event_checklists_event_id_phase_key" UNIQUE ("event_id", "phase")
);

CREATE TABLE IF NOT EXISTS "event_checklist_items" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "checklist_id" TEXT NOT NULL,
  "equipment_name" TEXT NOT NULL,
  "equipment_id" TEXT,
  "expected_quantity" INTEGER NOT NULL DEFAULT 0,
  "checked_quantity" INTEGER NOT NULL DEFAULT 0,
  "is_checked" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "event_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "event_checklists" ("id") ON DELETE CASCADE,
  CONSTRAINT "event_checklist_items_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "quote_approvals" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "quote_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "accepted_name" TEXT,
  "accepted_at" TEXT,
  "accepted_ip" TEXT,
  "accepted_user_agent" TEXT,
  "accepted_snapshot" TEXT,
  "rejection_reason" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "quote_approvals_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "external_quotes" ("id") ON DELETE CASCADE,
  CONSTRAINT "quote_approvals_token_key" UNIQUE ("token"),
  CONSTRAINT "quote_approvals_status_check" CHECK (status IN ('pendente','aceito','recusado','expirado'))
);

CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "body" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "message_templates_key_key" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "contract_templates" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "sections" TEXT NOT NULL DEFAULT '[]',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "contract_history" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "changes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "contract_history_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "person_sensitive_data" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "person_type" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "cpf" TEXT,
  "rg" TEXT,
  "pix_key" TEXT,
  "pix_key_type" TEXT,
  "bank_name" TEXT,
  "bank_agency" TEXT,
  "bank_account" TEXT,
  "bank_account_type" TEXT,
  "account_holder_name" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "person_status_history" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "person_type" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "person_name" TEXT,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "reason" TEXT,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);

CREATE TABLE IF NOT EXISTS "worker_availability" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "worker_id" TEXT,
  "worker_name" TEXT,
  "availability_date" TEXT NOT NULL,
  "period" TEXT NOT NULL DEFAULT 'integral',
  "availability" TEXT NOT NULL DEFAULT 'disponivel',
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "worker_availability_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "finance_titles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "description" TEXT NOT NULL,
  "total_amount" REAL NOT NULL,
  "client_id" TEXT,
  "event_id" TEXT,
  "contract_id" TEXT,
  "quote_id" TEXT,
  "supplier_name" TEXT,
  "category" TEXT,
  "cost_center" TEXT,
  "source_type" TEXT,
  "source_id" TEXT,
  "issue_date" TEXT NOT NULL DEFAULT (date('now','-3 hours')),
  "due_date" TEXT NOT NULL,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "finance_titles_kind_check" CHECK (kind IN ('receber','pagar')),
  CONSTRAINT "finance_titles_status_check" CHECK (status IN ('rascunho','pendente','aprovado','pago','cancelado','estornado')),
  CONSTRAINT "finance_titles_total_amount_check" CHECK (total_amount > 0)
);

CREATE TABLE IF NOT EXISTS "finance_installments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "title_id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "due_date" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "finance_installments_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "finance_titles" ("id"),
  CONSTRAINT "finance_installments_number_check" CHECK (number > 0),
  CONSTRAINT "finance_installments_amount_check" CHECK (amount > 0),
  CONSTRAINT "finance_installments_status_check" CHECK (status IN ('pendente','parcial','pago','cancelado')),
  CONSTRAINT "finance_installments_title_id_number_key" UNIQUE ("title_id", "number")
);

CREATE TABLE IF NOT EXISTS "finance_payments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "title_id" TEXT NOT NULL,
  "installment_id" TEXT,
  "amount" REAL NOT NULL,
  "paid_at" TEXT NOT NULL DEFAULT (date('now','-3 hours')),
  "method" TEXT,
  "bank_account_id" TEXT,
  "receipt_url" TEXT,
  "discount_amount" REAL NOT NULL DEFAULT 0,
  "interest_amount" REAL NOT NULL DEFAULT 0,
  "fine_amount" REAL NOT NULL DEFAULT 0,
  "is_reversal" INTEGER NOT NULL DEFAULT 0,
  "reverses_payment_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "finance_payments_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "finance_titles" ("id"),
  CONSTRAINT "finance_payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "finance_installments" ("id"),
  CONSTRAINT "finance_payments_amount_check" CHECK (amount > 0),
  CONSTRAINT "finance_payments_discount_amount_check" CHECK (discount_amount >= 0),
  CONSTRAINT "finance_payments_interest_amount_check" CHECK (interest_amount >= 0),
  CONSTRAINT "finance_payments_fine_amount_check" CHECK (fine_amount >= 0),
  CONSTRAINT "finance_payments_reverses_payment_id_fkey" FOREIGN KEY ("reverses_payment_id") REFERENCES "finance_payments" ("id")
);

CREATE TABLE IF NOT EXISTS "bank_transaction_reconciliations" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "bank_transaction_id" TEXT NOT NULL,
  "reconciled_by" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "bank_transaction_reconciliations_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions" ("id") ON DELETE RESTRICT,
  CONSTRAINT "bank_transaction_reconciliations_unique" UNIQUE ("bank_transaction_id")
);

CREATE TABLE IF NOT EXISTS "bank_account_closings" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "bank_account_id" TEXT NOT NULL,
  "closed_through" TEXT NOT NULL,
  "closing_balance" REAL NOT NULL DEFAULT 0,
  "closed_by" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "bank_account_closings_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id") ON DELETE RESTRICT,
  CONSTRAINT "bank_account_closings_unique" UNIQUE ("bank_account_id", "closed_through")
);

CREATE TABLE IF NOT EXISTS "personal_accounts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'wallet',
  "initial_balance_cents" INTEGER NOT NULL DEFAULT 0,
  "archived" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_accounts_id_owner_key" UNIQUE ("id", "owner_id")
);

CREATE TABLE IF NOT EXISTS "personal_categories" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'expense' CHECK ("kind" IS NULL OR "kind" IN ('expense','income')),
  "color" TEXT,
  "archived" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_categories_id_owner_key" UNIQUE ("id", "owner_id")
);

CREATE TABLE IF NOT EXISTS "personal_recurrences" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "frequency" TEXT NOT NULL DEFAULT 'monthly' CHECK ("frequency" IS NULL OR "frequency" IN ('weekly','monthly','yearly')),
  "day_of_period" INTEGER,
  "start_date" TEXT NOT NULL DEFAULT (date('now','-3 hours')),
  "end_date" TEXT,
  "active" INTEGER NOT NULL DEFAULT 1,
  "category_id" TEXT,
  "account_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_recurrences_id_owner_key" UNIQUE ("id", "owner_id"),
  CONSTRAINT "personal_recurrences_amount_positive" CHECK (amount_cents > 0),
  CONSTRAINT "personal_recurrences_period_valid" CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT "personal_recurrences_category_owner_fk" FOREIGN KEY ("category_id", "owner_id") REFERENCES "personal_categories" ("id", "owner_id") ON DELETE RESTRICT,
  CONSTRAINT "personal_recurrences_account_owner_fk" FOREIGN KEY ("account_id", "owner_id") REFERENCES "personal_accounts" ("id", "owner_id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "personal_expenses" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "expense_date" TEXT NOT NULL DEFAULT (date('now','-3 hours')),
  "kind" TEXT NOT NULL DEFAULT 'expense' CHECK ("kind" IS NULL OR "kind" IN ('expense','income')),
  "payment_method" TEXT,
  "installment_number" INTEGER,
  "installment_total" INTEGER,
  "notes" TEXT,
  "category_id" TEXT,
  "account_id" TEXT,
  "recurrence_id" TEXT,
  "parent_id" TEXT,
  "reverses_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_expenses_id_owner_key" UNIQUE ("id", "owner_id"),
  CONSTRAINT "personal_expenses_amount_positive" CHECK (amount_cents > 0),
  CONSTRAINT "personal_expenses_installments_valid" CHECK ((installment_number IS NULL AND installment_total IS NULL) OR ( installment_number IS NOT NULL AND installment_total IS NOT NULL AND installment_total >= 1 AND installment_number >= 1 AND installment_number <= installment_total )),
  CONSTRAINT "personal_expenses_not_self_reference" CHECK ((reverses_id IS NULL OR reverses_id <> id) AND (parent_id IS NULL OR parent_id <> id)),
  CONSTRAINT "personal_expenses_category_owner_fk" FOREIGN KEY ("category_id", "owner_id") REFERENCES "personal_categories" ("id", "owner_id") ON DELETE RESTRICT,
  CONSTRAINT "personal_expenses_account_owner_fk" FOREIGN KEY ("account_id", "owner_id") REFERENCES "personal_accounts" ("id", "owner_id") ON DELETE RESTRICT,
  CONSTRAINT "personal_expenses_recurrence_owner_fk" FOREIGN KEY ("recurrence_id", "owner_id") REFERENCES "personal_recurrences" ("id", "owner_id") ON DELETE RESTRICT,
  CONSTRAINT "personal_expenses_parent_owner_fk" FOREIGN KEY ("parent_id", "owner_id") REFERENCES "personal_expenses" ("id", "owner_id") ON DELETE RESTRICT,
  CONSTRAINT "personal_expenses_reverses_owner_fk" FOREIGN KEY ("reverses_id", "owner_id") REFERENCES "personal_expenses" ("id", "owner_id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "personal_budgets" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "category_id" TEXT,
  "month" TEXT NOT NULL,
  "limit_cents" INTEGER NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_budgets_id_owner_key" UNIQUE ("id", "owner_id"),
  CONSTRAINT "personal_budgets_limit_positive" CHECK (limit_cents > 0),
  CONSTRAINT "personal_budgets_category_owner_fk" FOREIGN KEY ("category_id", "owner_id") REFERENCES "personal_categories" ("id", "owner_id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "personal_expense_attachments" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "expense_id" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "file_name" TEXT,
  "file_size" INTEGER,
  "mime_type" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "personal_expense_attachments_id_owner_key" UNIQUE ("id", "owner_id"),
  CONSTRAINT "personal_expense_attachments_expense_owner_fk" FOREIGN KEY ("expense_id", "owner_id") REFERENCES "personal_expenses" ("id", "owner_id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "fiscal_profiles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT '55',
  "environment" TEXT NOT NULL DEFAULT 'homologacao',
  "operation_nature" TEXT,
  "purpose" TEXT,
  "default_cfop" TEXT,
  "default_cst" TEXT,
  "default_csosn" TEXT,
  "default_ncm" TEXT,
  "default_unit" TEXT NOT NULL DEFAULT 'UN',
  "icms_rate" REAL,
  "ipi_rate" REAL,
  "tax_regime" TEXT,
  "emitter" TEXT NOT NULL DEFAULT '{}',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "accountant_confirmed" INTEGER NOT NULL DEFAULT 0,
  "accountant_confirmed_by" TEXT,
  "accountant_confirmed_at" TEXT,
  "accountant_name" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "fiscal_profiles_model_chk" CHECK (model IN ('55','57','58')),
  CONSTRAINT "fiscal_profiles_env_chk" CHECK (environment IN ('homologacao','producao')),
  CONSTRAINT "fiscal_profiles_rates_chk" CHECK (COALESCE(icms_rate, 0) >= 0 AND COALESCE(icms_rate, 0) <= 100 AND COALESCE(ipi_rate, 0) >= 0 AND COALESCE(ipi_rate, 0) <= 100)
);

CREATE TABLE IF NOT EXISTS "fiscal_documents" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "profile_id" TEXT,
  "transport_id" TEXT,
  "event_id" TEXT,
  "model" TEXT NOT NULL DEFAULT '55',
  "series" TEXT NOT NULL DEFAULT '1',
  "number" TEXT,
  "purpose" TEXT NOT NULL DEFAULT 'remessa',
  "operation_nature" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'homologacao',
  "status" TEXT NOT NULL DEFAULT 'rascunho',
  "issue_date" TEXT NOT NULL DEFAULT (date('now')),
  "emitter" TEXT NOT NULL DEFAULT '{}',
  "recipient" TEXT NOT NULL DEFAULT '{}',
  "delivery" TEXT NOT NULL DEFAULT '{}',
  "vehicle" TEXT NOT NULL DEFAULT '{}',
  "driver" TEXT NOT NULL DEFAULT '{}',
  "route_states" TEXT NOT NULL DEFAULT '[]',
  "referenced_keys" TEXT NOT NULL DEFAULT '[]',
  "return_of_document_id" TEXT,
  "totals" TEXT NOT NULL DEFAULT '{}',
  "total_products_cents" INTEGER NOT NULL DEFAULT 0,
  "total_document_cents" INTEGER NOT NULL DEFAULT 0,
  "access_key" TEXT,
  "protocol_number" TEXT,
  "protocol_date" TEXT,
  "authorized_at" TEXT,
  "authorization_source" TEXT,
  "receipt_number" TEXT,
  "xml_path" TEXT,
  "xml_sha256" TEXT,
  "pdf_path" TEXT,
  "rejection_code" TEXT,
  "rejection_message" TEXT,
  "source" TEXT NOT NULL DEFAULT 'internal',
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "fiscal_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "fiscal_profiles" ("id"),
  CONSTRAINT "fiscal_documents_transport_id_fkey" FOREIGN KEY ("transport_id") REFERENCES "interstate_transports" ("id") ON DELETE SET NULL,
  CONSTRAINT "fiscal_documents_return_of_document_id_fkey" FOREIGN KEY ("return_of_document_id") REFERENCES "fiscal_documents" ("id"),
  CONSTRAINT "fiscal_documents_model_chk" CHECK (model IN ('55','57','58')),
  CONSTRAINT "fiscal_documents_env_chk" CHECK (environment IN ('homologacao','producao')),
  CONSTRAINT "fiscal_documents_status_chk" CHECK (status IN ( 'rascunho','validado','aguardando_assinatura','enviado','autorizado','rejeitado','cancelado','encerrado' )),
  CONSTRAINT "fiscal_documents_purpose_chk" CHECK (purpose IN ('remessa','retorno','prestacao_servico','manifesto','outro')),
  CONSTRAINT "fiscal_documents_source_chk" CHECK (source IN ('internal','external_import')),
  CONSTRAINT "fiscal_documents_auth_source_chk" CHECK (authorization_source IS NULL OR authorization_source IN ('sefaz_provider','external_import'))
);

CREATE TABLE IF NOT EXISTS "fiscal_document_items" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "document_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT NOT NULL,
  "ncm" TEXT,
  "cfop" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'UN',
  "quantity" REAL NOT NULL DEFAULT 1,
  "unit_value_cents" INTEGER NOT NULL DEFAULT 0,
  "total_cents" INTEGER NOT NULL DEFAULT 0,
  "cst" TEXT,
  "csosn" TEXT,
  "icms_rate" REAL,
  "ipi_rate" REAL,
  "extra" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "fiscal_document_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "fiscal_documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "fiscal_items_values_chk" CHECK (sequence > 0 AND quantity > 0 AND unit_value_cents >= 0 AND total_cents >= 0)
);

CREATE TABLE IF NOT EXISTS "fiscal_document_events" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "document_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "fiscal_document_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "fiscal_documents" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "event_transport_vehicles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))) PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "vehicle_model" TEXT NOT NULL,
  "vehicle_plate" TEXT,
  "driver_name" TEXT,
  "seats" INTEGER,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now')),
  CONSTRAINT "event_transport_vehicles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_records_equipment_id" ON "maintenance_records" ("equipment_id");
CREATE INDEX IF NOT EXISTS "idx_maintenance_records_status" ON "maintenance_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_maintenance_records_scheduled_date" ON "maintenance_records" ("scheduled_date");
CREATE INDEX IF NOT EXISTS "idx_maintenance_records_maintenance_type" ON "maintenance_records" ("maintenance_type");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_recurring_expense" ON "recurring_expense_payment_plans" ("recurring_expense_id");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_date" ON "recurring_expense_payment_plans" ("planned_date");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_status" ON "recurring_expense_payment_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_contracts_client_name" ON "contracts" ("client_name");
CREATE INDEX IF NOT EXISTS "idx_contracts_status" ON "contracts" ("status");
CREATE INDEX IF NOT EXISTS "idx_contracts_start_date" ON "contracts" ("start_date");
CREATE INDEX IF NOT EXISTS "idx_contract_payments_contract_id" ON "contract_payments" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_contract_attachments_contract_id" ON "contract_attachments" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_saved_signatures_created_by" ON "saved_signatures" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_saved_signatures_type" ON "saved_signatures" ("signature_type");
CREATE INDEX IF NOT EXISTS "idx_daily_rates_date" ON "daily_rates" ("date");
CREATE INDEX IF NOT EXISTS "idx_daily_rates_event_id" ON "daily_rates" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_daily_rates_worker_name" ON "daily_rates" ("worker_name");
CREATE INDEX IF NOT EXISTS "idx_collaborator_payments_collaborator_id" ON "collaborator_payments" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_payments_event_id" ON "collaborator_payments" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_payments_payment_date" ON "collaborator_payments" ("payment_date");
CREATE INDEX IF NOT EXISTS "idx_collaborator_advances_collaborator_id" ON "collaborator_advances" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_advances_advance_date" ON "collaborator_advances" ("advance_date");
CREATE INDEX IF NOT EXISTS "idx_collaborator_monthly_salaries_collaborator_month" ON "collaborator_monthly_salaries" ("collaborator_id", "salary_year", "salary_month");
CREATE INDEX IF NOT EXISTS "idx_event_expenses_reference" ON "event_expenses" ("reference_type", "reference_id");
CREATE INDEX IF NOT EXISTS "idx_event_collaborators_reference" ON "event_collaborators" ("reference_type", "reference_id");
CREATE INDEX IF NOT EXISTS "idx_worker_expense_advances_worker_name" ON "worker_expense_advances" ("worker_name");
CREATE INDEX IF NOT EXISTS "idx_worker_expense_advances_date" ON "worker_expense_advances" ("advance_date");
CREATE INDEX IF NOT EXISTS "idx_collaborator_expense_advances_collaborator_id" ON "collaborator_expense_advances" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_expense_advances_advance_date" ON "collaborator_expense_advances" ("advance_date");
CREATE INDEX IF NOT EXISTS "idx_client_advances_client_id" ON "client_advances" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_client_advances_advance_date" ON "client_advances" ("advance_date");
CREATE INDEX IF NOT EXISTS "idx_client_custom_items_client_id" ON "client_custom_items" ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bank_transactions_reference_id_unique_idx" ON "bank_transactions" ("reference_id") WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_collaborator_food_allowances_collaborator_id" ON "collaborator_food_allowances" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_food_allowances_date" ON "collaborator_food_allowances" ("allowance_date");
CREATE INDEX IF NOT EXISTS "idx_collaborator_food_allowances_event_id" ON "collaborator_food_allowances" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_collaborator_food_allowances_allowance_date" ON "collaborator_food_allowances" ("allowance_date");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_status" ON "whatsapp_messages" ("status");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_event_id" ON "whatsapp_messages" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_received_at" ON "whatsapp_messages" ("received_at");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_status" ON "nfse_invoices" ("status");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_issue_date" ON "nfse_invoices" ("issue_date");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_rps_number" ON "nfse_invoices" ("rps_number");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_invoice_number" ON "nfse_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_taker_document" ON "nfse_invoices" ("taker_document");
CREATE INDEX IF NOT EXISTS "idx_nfse_invoices_event_id" ON "nfse_invoices" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_app_error_logs_created_at" ON "app_error_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_event_checklists_event" ON "event_checklists" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_event_checklist_items_checklist" ON "event_checklist_items" ("checklist_id");
CREATE INDEX IF NOT EXISTS "idx_quote_approvals_quote" ON "quote_approvals" ("quote_id");
CREATE INDEX IF NOT EXISTS "idx_quote_approvals_token" ON "quote_approvals" ("token");
CREATE INDEX IF NOT EXISTS "idx_event_budgets_source_item_id" ON "event_budgets" ("source_item_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_quotes_quote_number" ON "external_quotes" ("quote_number") WHERE quote_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "contract_templates_name_version_key" ON "contract_templates" ("name", "version");
CREATE INDEX IF NOT EXISTS "contract_history_contract_id_idx" ON "contract_history" ("contract_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "person_sensitive_data_unique" ON "person_sensitive_data" ("person_type", "person_id");
CREATE INDEX IF NOT EXISTS "person_sensitive_data_cpf_idx" ON "person_sensitive_data" ("cpf") WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS "person_status_history_person_idx" ON "person_status_history" ("person_type", "person_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "worker_availability_unique" ON "worker_availability" ("worker_id", "availability_date", "period") WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "worker_availability_date_idx" ON "worker_availability" ("availability_date");
CREATE INDEX IF NOT EXISTS "daily_rates_worker_id_idx" ON "daily_rates" ("worker_id");
CREATE INDEX IF NOT EXISTS "event_collaborators_collab_id_idx" ON "event_collaborators" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "event_collaborators_worker_id_idx" ON "event_collaborators" ("worker_id");
CREATE INDEX IF NOT EXISTS "daily_rates_payment_status_idx" ON "daily_rates" ("payment_status");
CREATE INDEX IF NOT EXISTS "daily_rates_date_idx" ON "daily_rates" ("date");
CREATE INDEX IF NOT EXISTS "workers_phone_idx" ON "workers" ("phone") WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS "collaborators_phone_idx" ON "collaborators" ("phone") WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS "workers_name_lower_idx" ON "workers" (lower(name));
CREATE INDEX IF NOT EXISTS "collaborators_name_lower_idx" ON "collaborators" (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS "finance_titles_source_uidx" ON "finance_titles" ("source_type", "source_id") WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "finance_payments_reversal_uidx" ON "finance_payments" ("reverses_payment_id") WHERE reverses_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "finance_titles_due_idx" ON "finance_titles" ("kind", "status", "due_date");
CREATE INDEX IF NOT EXISTS "finance_titles_event_idx" ON "finance_titles" ("event_id");
CREATE INDEX IF NOT EXISTS "finance_installments_title_idx" ON "finance_installments" ("title_id");
CREATE INDEX IF NOT EXISTS "finance_payments_title_idx" ON "finance_payments" ("title_id");
CREATE INDEX IF NOT EXISTS "idx_btr_tx" ON "bank_transaction_reconciliations" ("bank_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_bac_account" ON "bank_account_closings" ("bank_account_id", "closed_through");
CREATE INDEX IF NOT EXISTS "idx_personal_accounts_owner" ON "personal_accounts" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_personal_categories_owner" ON "personal_categories" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_personal_recurrences_owner" ON "personal_recurrences" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_personal_expenses_owner_date" ON "personal_expenses" ("owner_id", "expense_date");
CREATE INDEX IF NOT EXISTS "idx_personal_expenses_parent" ON "personal_expenses" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_personal_budgets_owner_month" ON "personal_budgets" ("owner_id", "month");
CREATE INDEX IF NOT EXISTS "idx_personal_attachments_expense" ON "personal_expense_attachments" ("expense_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_budget_owner_cat_month" ON "personal_budgets" ("owner_id", "category_id", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_personal_expenses_single_reversal" ON "personal_expenses" ("reverses_id") WHERE reverses_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_pluggy_account_uidx" ON "bank_accounts" ("pluggy_account_id") WHERE pluggy_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "bank_transactions_pluggy_transaction_uidx" ON "bank_transactions" ("pluggy_transaction_id") WHERE pluggy_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_date" ON "interstate_transports" ("transport_date");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_event" ON "interstate_transports" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_plate" ON "interstate_transports" ("vehicle_plate");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_status" ON "interstate_transports" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_access_key_uidx" ON "fiscal_documents" ("access_key") WHERE access_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_numbering_uidx" ON "fiscal_documents" ("model", "series", "number", "environment") WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_document_items_seq_uidx" ON "fiscal_document_items" ("document_id", "sequence");
CREATE INDEX IF NOT EXISTS "fiscal_documents_transport_idx" ON "fiscal_documents" ("transport_id");
CREATE INDEX IF NOT EXISTS "fiscal_documents_status_idx" ON "fiscal_documents" ("status");
CREATE INDEX IF NOT EXISTS "fiscal_document_events_doc_idx" ON "fiscal_document_events" ("document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bank_transactions_import_fingerprint_uidx" ON "bank_transactions" ("import_fingerprint") WHERE import_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_extraction_status" ON "whatsapp_messages" ("extraction_status");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_person" ON "whatsapp_messages" ("person_type", "person_id");
CREATE INDEX IF NOT EXISTS "event_transport_vehicles_event_idx" ON "event_transport_vehicles" ("event_id");

-- Registro de alterações por tabela (substitui o Supabase Realtime)
CREATE TRIGGER IF NOT EXISTS "_rt_profiles_insert" AFTER INSERT ON "profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_profiles_update" AFTER UPDATE ON "profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_profiles_delete" AFTER DELETE ON "profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_roles_insert" AFTER INSERT ON "user_roles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_roles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_roles_update" AFTER UPDATE ON "user_roles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_roles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_roles_delete" AFTER DELETE ON "user_roles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_roles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_permissions_insert" AFTER INSERT ON "permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_permissions_update" AFTER UPDATE ON "permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_permissions_delete" AFTER DELETE ON "permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_role_permissions_insert" AFTER INSERT ON "role_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('role_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_role_permissions_update" AFTER UPDATE ON "role_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('role_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_role_permissions_delete" AFTER DELETE ON "role_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('role_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_events_insert" AFTER INSERT ON "events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_events_update" AFTER UPDATE ON "events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_events_delete" AFTER DELETE ON "events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_expenses_insert" AFTER INSERT ON "event_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_expenses_update" AFTER UPDATE ON "event_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_expenses_delete" AFTER DELETE ON "event_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_equipment_insert" AFTER INSERT ON "event_equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_equipment_update" AFTER UPDATE ON "event_equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_equipment_delete" AFTER DELETE ON "event_equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_equipment_insert" AFTER INSERT ON "equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_equipment_update" AFTER UPDATE ON "equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_equipment_delete" AFTER DELETE ON "equipment" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('equipment', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_clients_insert" AFTER INSERT ON "clients" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('clients', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_clients_update" AFTER UPDATE ON "clients" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('clients', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_clients_delete" AFTER DELETE ON "clients" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('clients', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_collaborators_insert" AFTER INSERT ON "event_collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_collaborators_update" AFTER UPDATE ON "event_collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_collaborators_delete" AFTER DELETE ON "event_collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_accounts_insert" AFTER INSERT ON "bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_accounts_update" AFTER UPDATE ON "bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_accounts_delete" AFTER DELETE ON "bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transactions_insert" AFTER INSERT ON "bank_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transactions_update" AFTER UPDATE ON "bank_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transactions_delete" AFTER DELETE ON "bank_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_settings_insert" AFTER INSERT ON "company_settings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_settings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_settings_update" AFTER UPDATE ON "company_settings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_settings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_settings_delete" AFTER DELETE ON "company_settings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_settings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_credentials_insert" AFTER INSERT ON "user_credentials" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_credentials', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_credentials_update" AFTER UPDATE ON "user_credentials" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_credentials', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_credentials_delete" AFTER DELETE ON "user_credentials" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_credentials', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_theme_preferences_insert" AFTER INSERT ON "user_theme_preferences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_theme_preferences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_theme_preferences_update" AFTER UPDATE ON "user_theme_preferences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_theme_preferences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_theme_preferences_delete" AFTER DELETE ON "user_theme_preferences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_theme_preferences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborators_insert" AFTER INSERT ON "collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborators_update" AFTER UPDATE ON "collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborators_delete" AFTER DELETE ON "collaborators" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborators', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_maintenance_records_insert" AFTER INSERT ON "maintenance_records" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('maintenance_records', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_maintenance_records_update" AFTER UPDATE ON "maintenance_records" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('maintenance_records', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_maintenance_records_delete" AFTER DELETE ON "maintenance_records" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('maintenance_records', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_patrimony_inventory_insert" AFTER INSERT ON "patrimony_inventory" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('patrimony_inventory', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_patrimony_inventory_update" AFTER UPDATE ON "patrimony_inventory" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('patrimony_inventory', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_patrimony_inventory_delete" AFTER DELETE ON "patrimony_inventory" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('patrimony_inventory', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_insert" AFTER INSERT ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_update" AFTER UPDATE ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_delete" AFTER DELETE ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_insert" AFTER INSERT ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_update" AFTER UPDATE ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_delete" AFTER DELETE ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_insert" AFTER INSERT ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_update" AFTER UPDATE ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_delete" AFTER DELETE ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_insert" AFTER INSERT ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_update" AFTER UPDATE ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_delete" AFTER DELETE ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_budgets_insert" AFTER INSERT ON "event_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_budgets_update" AFTER UPDATE ON "event_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_budgets_delete" AFTER DELETE ON "event_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_insert" AFTER INSERT ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_update" AFTER UPDATE ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_delete" AFTER DELETE ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contracts_insert" AFTER INSERT ON "contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contracts_update" AFTER UPDATE ON "contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contracts_delete" AFTER DELETE ON "contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_attachments_insert" AFTER INSERT ON "contract_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_attachments_update" AFTER UPDATE ON "contract_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_attachments_delete" AFTER DELETE ON "contract_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_payments_insert" AFTER INSERT ON "contract_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_payments_update" AFTER UPDATE ON "contract_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_payments_delete" AFTER DELETE ON "contract_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_external_quotes_insert" AFTER INSERT ON "external_quotes" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('external_quotes', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_external_quotes_update" AFTER UPDATE ON "external_quotes" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('external_quotes', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_external_quotes_delete" AFTER DELETE ON "external_quotes" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('external_quotes', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_signatures_insert" AFTER INSERT ON "saved_signatures" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_signatures', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_signatures_update" AFTER UPDATE ON "saved_signatures" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_signatures', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_signatures_delete" AFTER DELETE ON "saved_signatures" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_signatures', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_insert" AFTER INSERT ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_update" AFTER UPDATE ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_delete" AFTER DELETE ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_daily_rates_insert" AFTER INSERT ON "daily_rates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('daily_rates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_daily_rates_update" AFTER UPDATE ON "daily_rates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('daily_rates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_daily_rates_delete" AFTER DELETE ON "daily_rates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('daily_rates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_advances_insert" AFTER INSERT ON "worker_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_advances_update" AFTER UPDATE ON "worker_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_advances_delete" AFTER DELETE ON "worker_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_workers_insert" AFTER INSERT ON "workers" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('workers', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_workers_update" AFTER UPDATE ON "workers" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('workers', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_workers_delete" AFTER DELETE ON "workers" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('workers', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_payments_insert" AFTER INSERT ON "collaborator_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_payments_update" AFTER UPDATE ON "collaborator_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_payments_delete" AFTER DELETE ON "collaborator_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_advances_insert" AFTER INSERT ON "collaborator_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_advances_update" AFTER UPDATE ON "collaborator_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_advances_delete" AFTER DELETE ON "collaborator_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_insert" AFTER INSERT ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_update" AFTER UPDATE ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_delete" AFTER DELETE ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_expense_advances_insert" AFTER INSERT ON "worker_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_expense_advances_update" AFTER UPDATE ON "worker_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_expense_advances_delete" AFTER DELETE ON "worker_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_expense_advances_insert" AFTER INSERT ON "collaborator_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_expense_advances_update" AFTER UPDATE ON "collaborator_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_expense_advances_delete" AFTER DELETE ON "collaborator_expense_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_expense_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_advances_insert" AFTER INSERT ON "client_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_advances_update" AFTER UPDATE ON "client_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_advances_delete" AFTER DELETE ON "client_advances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_advances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_custom_items_insert" AFTER INSERT ON "client_custom_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_custom_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_custom_items_update" AFTER UPDATE ON "client_custom_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_custom_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_client_custom_items_delete" AFTER DELETE ON "client_custom_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('client_custom_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_bank_accounts_insert" AFTER INSERT ON "saved_bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_bank_accounts_update" AFTER UPDATE ON "saved_bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_saved_bank_accounts_delete" AFTER DELETE ON "saved_bank_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('saved_bank_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_expenses_insert" AFTER INSERT ON "company_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_expenses_update" AFTER UPDATE ON "company_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_expenses_delete" AFTER DELETE ON "company_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_permissions_insert" AFTER INSERT ON "user_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_permissions_update" AFTER UPDATE ON "user_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_user_permissions_delete" AFTER DELETE ON "user_permissions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('user_permissions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_approval_requests_insert" AFTER INSERT ON "approval_requests" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('approval_requests', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_approval_requests_update" AFTER UPDATE ON "approval_requests" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('approval_requests', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_approval_requests_delete" AFTER DELETE ON "approval_requests" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('approval_requests', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_log_insert" AFTER INSERT ON "audit_log" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_log', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_log_update" AFTER UPDATE ON "audit_log" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_log', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_log_delete" AFTER DELETE ON "audit_log" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_log', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expenses_insert" AFTER INSERT ON "company_fixed_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expenses_update" AFTER UPDATE ON "company_fixed_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expenses_delete" AFTER DELETE ON "company_fixed_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expense_monthly_payments_insert" AFTER INSERT ON "company_fixed_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expense_monthly_payments_update" AFTER UPDATE ON "company_fixed_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_company_fixed_expense_monthly_payments_delete" AFTER DELETE ON "company_fixed_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('company_fixed_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_contracts_insert" AFTER INSERT ON "event_contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_contracts_update" AFTER UPDATE ON "event_contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_contracts_delete" AFTER DELETE ON "event_contracts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_contracts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_food_allowances_insert" AFTER INSERT ON "collaborator_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_food_allowances_update" AFTER UPDATE ON "collaborator_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_food_allowances_delete" AFTER DELETE ON "collaborator_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_food_allowances_insert" AFTER INSERT ON "worker_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_food_allowances_update" AFTER UPDATE ON "worker_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_food_allowances_delete" AFTER DELETE ON "worker_food_allowances" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_food_allowances', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_whatsapp_messages_insert" AFTER INSERT ON "whatsapp_messages" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('whatsapp_messages', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_whatsapp_messages_update" AFTER UPDATE ON "whatsapp_messages" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('whatsapp_messages', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_whatsapp_messages_delete" AFTER DELETE ON "whatsapp_messages" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('whatsapp_messages', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_invoices_insert" AFTER INSERT ON "nfse_invoices" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_invoices', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_invoices_update" AFTER UPDATE ON "nfse_invoices" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_invoices', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_invoices_delete" AFTER DELETE ON "nfse_invoices" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_invoices', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_certificates_insert" AFTER INSERT ON "nfse_certificates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_certificates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_certificates_update" AFTER UPDATE ON "nfse_certificates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_certificates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_certificates_delete" AFTER DELETE ON "nfse_certificates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_certificates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_config_insert" AFTER INSERT ON "nfse_config" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_config', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_config_update" AFTER UPDATE ON "nfse_config" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_config', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_nfse_config_delete" AFTER DELETE ON "nfse_config" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('nfse_config', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_app_error_logs_insert" AFTER INSERT ON "app_error_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('app_error_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_app_error_logs_update" AFTER UPDATE ON "app_error_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('app_error_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_app_error_logs_delete" AFTER DELETE ON "app_error_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('app_error_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_logs_insert" AFTER INSERT ON "audit_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_logs_update" AFTER UPDATE ON "audit_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_audit_logs_delete" AFTER DELETE ON "audit_logs" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('audit_logs', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklists_insert" AFTER INSERT ON "event_checklists" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklists', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklists_update" AFTER UPDATE ON "event_checklists" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklists', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklists_delete" AFTER DELETE ON "event_checklists" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklists', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklist_items_insert" AFTER INSERT ON "event_checklist_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklist_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklist_items_update" AFTER UPDATE ON "event_checklist_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklist_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_checklist_items_delete" AFTER DELETE ON "event_checklist_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_checklist_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_quote_approvals_insert" AFTER INSERT ON "quote_approvals" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('quote_approvals', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_quote_approvals_update" AFTER UPDATE ON "quote_approvals" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('quote_approvals', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_quote_approvals_delete" AFTER DELETE ON "quote_approvals" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('quote_approvals', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_message_templates_insert" AFTER INSERT ON "message_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('message_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_message_templates_update" AFTER UPDATE ON "message_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('message_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_message_templates_delete" AFTER DELETE ON "message_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('message_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_templates_insert" AFTER INSERT ON "contract_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_templates_update" AFTER UPDATE ON "contract_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_templates_delete" AFTER DELETE ON "contract_templates" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_templates', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_history_insert" AFTER INSERT ON "contract_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_history_update" AFTER UPDATE ON "contract_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_contract_history_delete" AFTER DELETE ON "contract_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('contract_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_sensitive_data_insert" AFTER INSERT ON "person_sensitive_data" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_sensitive_data', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_sensitive_data_update" AFTER UPDATE ON "person_sensitive_data" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_sensitive_data', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_sensitive_data_delete" AFTER DELETE ON "person_sensitive_data" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_sensitive_data', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_status_history_insert" AFTER INSERT ON "person_status_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_status_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_status_history_update" AFTER UPDATE ON "person_status_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_status_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_person_status_history_delete" AFTER DELETE ON "person_status_history" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('person_status_history', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_availability_insert" AFTER INSERT ON "worker_availability" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_availability', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_availability_update" AFTER UPDATE ON "worker_availability" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_availability', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_worker_availability_delete" AFTER DELETE ON "worker_availability" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('worker_availability', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_titles_insert" AFTER INSERT ON "finance_titles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_titles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_titles_update" AFTER UPDATE ON "finance_titles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_titles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_titles_delete" AFTER DELETE ON "finance_titles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_titles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_installments_insert" AFTER INSERT ON "finance_installments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_installments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_installments_update" AFTER UPDATE ON "finance_installments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_installments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_installments_delete" AFTER DELETE ON "finance_installments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_installments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_payments_insert" AFTER INSERT ON "finance_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_payments_update" AFTER UPDATE ON "finance_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_finance_payments_delete" AFTER DELETE ON "finance_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('finance_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transaction_reconciliations_insert" AFTER INSERT ON "bank_transaction_reconciliations" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transaction_reconciliations', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transaction_reconciliations_update" AFTER UPDATE ON "bank_transaction_reconciliations" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transaction_reconciliations', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_transaction_reconciliations_delete" AFTER DELETE ON "bank_transaction_reconciliations" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_transaction_reconciliations', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_account_closings_insert" AFTER INSERT ON "bank_account_closings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_account_closings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_account_closings_update" AFTER UPDATE ON "bank_account_closings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_account_closings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_account_closings_delete" AFTER DELETE ON "bank_account_closings" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_account_closings', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_accounts_insert" AFTER INSERT ON "personal_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_accounts_update" AFTER UPDATE ON "personal_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_accounts_delete" AFTER DELETE ON "personal_accounts" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_accounts', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_categories_insert" AFTER INSERT ON "personal_categories" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_categories', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_categories_update" AFTER UPDATE ON "personal_categories" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_categories', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_categories_delete" AFTER DELETE ON "personal_categories" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_categories', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_recurrences_insert" AFTER INSERT ON "personal_recurrences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_recurrences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_recurrences_update" AFTER UPDATE ON "personal_recurrences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_recurrences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_recurrences_delete" AFTER DELETE ON "personal_recurrences" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_recurrences', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expenses_insert" AFTER INSERT ON "personal_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expenses_update" AFTER UPDATE ON "personal_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expenses_delete" AFTER DELETE ON "personal_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_budgets_insert" AFTER INSERT ON "personal_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_budgets_update" AFTER UPDATE ON "personal_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_budgets_delete" AFTER DELETE ON "personal_budgets" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_budgets', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expense_attachments_insert" AFTER INSERT ON "personal_expense_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expense_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expense_attachments_update" AFTER UPDATE ON "personal_expense_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expense_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_personal_expense_attachments_delete" AFTER DELETE ON "personal_expense_attachments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('personal_expense_attachments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_profiles_insert" AFTER INSERT ON "fiscal_profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_profiles_update" AFTER UPDATE ON "fiscal_profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_profiles_delete" AFTER DELETE ON "fiscal_profiles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_profiles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_documents_insert" AFTER INSERT ON "fiscal_documents" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_documents', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_documents_update" AFTER UPDATE ON "fiscal_documents" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_documents', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_documents_delete" AFTER DELETE ON "fiscal_documents" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_documents', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_items_insert" AFTER INSERT ON "fiscal_document_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_items_update" AFTER UPDATE ON "fiscal_document_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_items_delete" AFTER DELETE ON "fiscal_document_items" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_items', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_events_insert" AFTER INSERT ON "fiscal_document_events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_events_update" AFTER UPDATE ON "fiscal_document_events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_fiscal_document_events_delete" AFTER DELETE ON "fiscal_document_events" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('fiscal_document_events', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_transport_vehicles_insert" AFTER INSERT ON "event_transport_vehicles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_transport_vehicles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_transport_vehicles_update" AFTER UPDATE ON "event_transport_vehicles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_transport_vehicles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_event_transport_vehicles_delete" AFTER DELETE ON "event_transport_vehicles" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('event_transport_vehicles', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
