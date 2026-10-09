-- Alinha a cópia com o banco real: remove regras de valor único e validações
-- (CHECK) que só existiam no histórico de migrações. Ver NOT_IN_REAL em
-- tools/gen_d1_schema.py. No SQLite uma restrição de tabela só sai recriando a
-- tabela: copia os dados, recria a tabela, devolve os dados e recria índices e
-- regras automáticas dela.

DROP INDEX IF EXISTS "bank_transactions_reference_id_unique_idx";
DROP INDEX IF EXISTS "uq_external_quotes_quote_number";

CREATE TABLE "_bak_bank_card_transactions" AS SELECT * FROM "bank_card_transactions";
CREATE TABLE "_bak_bank_cards" AS SELECT * FROM "bank_cards";
CREATE TABLE "_bak_recurring_expense_monthly_payments" AS SELECT * FROM "recurring_expense_monthly_payments";
CREATE TABLE "_bak_recurring_expense_payment_plans" AS SELECT * FROM "recurring_expense_payment_plans";
CREATE TABLE "_bak_recurring_expenses" AS SELECT * FROM "recurring_expenses";
CREATE TABLE "_bak_collaborator_monthly_salaries" AS SELECT * FROM "collaborator_monthly_salaries";
CREATE TABLE "_bak_interstate_transports" AS SELECT * FROM "interstate_transports";
DROP TABLE "bank_card_transactions";
DROP TABLE "bank_cards";
DROP TABLE "recurring_expense_monthly_payments";
DROP TABLE "recurring_expense_payment_plans";
DROP TABLE "recurring_expenses";
DROP TABLE "collaborator_monthly_salaries";
DROP TABLE "interstate_transports";
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
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
);
INSERT INTO "bank_cards" SELECT * FROM "_bak_bank_cards";
DROP TABLE "_bak_bank_cards";
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_insert" AFTER INSERT ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_update" AFTER UPDATE ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_cards_delete" AFTER DELETE ON "bank_cards" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_cards', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  CONSTRAINT "bank_card_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "bank_cards" ("id") ON DELETE CASCADE
);
INSERT INTO "bank_card_transactions" SELECT * FROM "_bak_bank_card_transactions";
DROP TABLE "_bak_bank_card_transactions";
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_insert" AFTER INSERT ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_update" AFTER UPDATE ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_bank_card_transactions_delete" AFTER DELETE ON "bank_card_transactions" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('bank_card_transactions', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  "receipt_path" TEXT
);
INSERT INTO "recurring_expenses" SELECT * FROM "_bak_recurring_expenses";
DROP TABLE "_bak_recurring_expenses";
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_insert" AFTER INSERT ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_update" AFTER UPDATE ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expenses_delete" AFTER DELETE ON "recurring_expenses" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expenses', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  "receipt_path" TEXT
);
INSERT INTO "recurring_expense_monthly_payments" SELECT * FROM "_bak_recurring_expense_monthly_payments";
DROP TABLE "_bak_recurring_expense_monthly_payments";
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_insert" AFTER INSERT ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_update" AFTER UPDATE ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_monthly_payments_delete" AFTER DELETE ON "recurring_expense_monthly_payments" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_monthly_payments', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  CONSTRAINT "recurring_expense_payment_plans_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);
INSERT INTO "recurring_expense_payment_plans" SELECT * FROM "_bak_recurring_expense_payment_plans";
DROP TABLE "_bak_recurring_expense_payment_plans";
CREATE INDEX IF NOT EXISTS "idx_payment_plans_recurring_expense" ON "recurring_expense_payment_plans" ("recurring_expense_id");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_date" ON "recurring_expense_payment_plans" ("planned_date");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_status" ON "recurring_expense_payment_plans" ("status");
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_insert" AFTER INSERT ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_update" AFTER UPDATE ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_recurring_expense_payment_plans_delete" AFTER DELETE ON "recurring_expense_payment_plans" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('recurring_expense_payment_plans', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  CONSTRAINT "collaborator_monthly_salaries_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts" ("id")
);
INSERT INTO "collaborator_monthly_salaries" SELECT * FROM "_bak_collaborator_monthly_salaries";
DROP TABLE "_bak_collaborator_monthly_salaries";
CREATE INDEX IF NOT EXISTS "idx_collaborator_monthly_salaries_collaborator_month" ON "collaborator_monthly_salaries" ("collaborator_id", "salary_year", "salary_month");
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_insert" AFTER INSERT ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_update" AFTER UPDATE ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_collaborator_monthly_salaries_delete" AFTER DELETE ON "collaborator_monthly_salaries" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('collaborator_monthly_salaries', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

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
  CONSTRAINT "interstate_transports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL
);
INSERT INTO "interstate_transports" SELECT * FROM "_bak_interstate_transports";
DROP TABLE "_bak_interstate_transports";
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_date" ON "interstate_transports" ("transport_date");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_event" ON "interstate_transports" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_plate" ON "interstate_transports" ("vehicle_plate");
CREATE INDEX IF NOT EXISTS "idx_interstate_transports_status" ON "interstate_transports" ("status");
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_insert" AFTER INSERT ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_update" AFTER UPDATE ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;
CREATE TRIGGER IF NOT EXISTS "_rt_interstate_transports_delete" AFTER DELETE ON "interstate_transports" BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('interstate_transports', (SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;

CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expenses__insert" AFTER INSERT ON "recurring_expenses" FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'INSERT', 'recurring_expenses', NEW.id, NULL, json_insert(json_object('id', NEW."id", 'name', NEW."name", 'category', NEW."category", 'amount', NEW."amount", 'description', NEW."description", 'is_active', CASE WHEN NEW."is_active" IS NULL THEN NULL WHEN NEW."is_active" THEN json('true') ELSE json('false') END, 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'is_paid', CASE WHEN NEW."is_paid" IS NULL THEN NULL WHEN NEW."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', NEW."payment_date", 'payment_bank_account', NEW."payment_bank_account", 'start_date', NEW."start_date", 'end_date', NEW."end_date", 'selected_months', json(NEW."selected_months")), '$.selected_year', NEW."selected_year", '$.due_day', NEW."due_day", '$.receipt_path', NEW."receipt_path"));
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expenses__update" AFTER UPDATE ON "recurring_expenses" FOR EACH ROW WHEN json_insert(json_object('id', OLD."id", 'name', OLD."name", 'category', OLD."category", 'amount', OLD."amount", 'description', OLD."description", 'is_active', CASE WHEN OLD."is_active" IS NULL THEN NULL WHEN OLD."is_active" THEN json('true') ELSE json('false') END, 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'is_paid', CASE WHEN OLD."is_paid" IS NULL THEN NULL WHEN OLD."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', OLD."payment_date", 'payment_bank_account', OLD."payment_bank_account", 'start_date', OLD."start_date", 'end_date', OLD."end_date", 'selected_months', json(OLD."selected_months")), '$.selected_year', OLD."selected_year", '$.due_day', OLD."due_day", '$.receipt_path', OLD."receipt_path") IS NOT json_insert(json_object('id', NEW."id", 'name', NEW."name", 'category', NEW."category", 'amount', NEW."amount", 'description', NEW."description", 'is_active', CASE WHEN NEW."is_active" IS NULL THEN NULL WHEN NEW."is_active" THEN json('true') ELSE json('false') END, 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'is_paid', CASE WHEN NEW."is_paid" IS NULL THEN NULL WHEN NEW."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', NEW."payment_date", 'payment_bank_account', NEW."payment_bank_account", 'start_date', NEW."start_date", 'end_date', NEW."end_date", 'selected_months', json(NEW."selected_months")), '$.selected_year', NEW."selected_year", '$.due_day', NEW."due_day", '$.receipt_path', NEW."receipt_path")
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'UPDATE', 'recurring_expenses', NEW.id, json_insert(json_object('id', OLD."id", 'name', OLD."name", 'category', OLD."category", 'amount', OLD."amount", 'description', OLD."description", 'is_active', CASE WHEN OLD."is_active" IS NULL THEN NULL WHEN OLD."is_active" THEN json('true') ELSE json('false') END, 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'is_paid', CASE WHEN OLD."is_paid" IS NULL THEN NULL WHEN OLD."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', OLD."payment_date", 'payment_bank_account', OLD."payment_bank_account", 'start_date', OLD."start_date", 'end_date', OLD."end_date", 'selected_months', json(OLD."selected_months")), '$.selected_year', OLD."selected_year", '$.due_day', OLD."due_day", '$.receipt_path', OLD."receipt_path"), json_insert(json_object('id', NEW."id", 'name', NEW."name", 'category', NEW."category", 'amount', NEW."amount", 'description', NEW."description", 'is_active', CASE WHEN NEW."is_active" IS NULL THEN NULL WHEN NEW."is_active" THEN json('true') ELSE json('false') END, 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'is_paid', CASE WHEN NEW."is_paid" IS NULL THEN NULL WHEN NEW."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', NEW."payment_date", 'payment_bank_account', NEW."payment_bank_account", 'start_date', NEW."start_date", 'end_date', NEW."end_date", 'selected_months', json(NEW."selected_months")), '$.selected_year', NEW."selected_year", '$.due_day', NEW."due_day", '$.receipt_path', NEW."receipt_path"));
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expenses__delete" AFTER DELETE ON "recurring_expenses" FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'DELETE', 'recurring_expenses', OLD.id, json_insert(json_object('id', OLD."id", 'name', OLD."name", 'category', OLD."category", 'amount', OLD."amount", 'description', OLD."description", 'is_active', CASE WHEN OLD."is_active" IS NULL THEN NULL WHEN OLD."is_active" THEN json('true') ELSE json('false') END, 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'is_paid', CASE WHEN OLD."is_paid" IS NULL THEN NULL WHEN OLD."is_paid" THEN json('true') ELSE json('false') END, 'payment_date', OLD."payment_date", 'payment_bank_account', OLD."payment_bank_account", 'start_date', OLD."start_date", 'end_date', OLD."end_date", 'selected_months', json(OLD."selected_months")), '$.selected_year', OLD."selected_year", '$.due_day', OLD."due_day", '$.receipt_path', OLD."receipt_path"), NULL);
END;
CREATE TRIGGER IF NOT EXISTS "update_bank_transaction_for_recurring_expense_payment__update" AFTER UPDATE ON "recurring_expense_monthly_payments" FOR EACH ROW
BEGIN
  DELETE FROM bank_transactions WHERE reference_type = 'recurring_expense' AND reference_id = OLD.id;
  INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, reference_type, reference_id, transaction_date) SELECT NEW.bank_account_id, 'Despesa Fixa - ' || COALESCE((SELECT name FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'N/A'), NEW.payment_amount, 'expense', COALESCE((SELECT category FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'Despesas Fixas'), 'recurring_expense', NEW.id, NEW.payment_date WHERE NEW.bank_account_id IS NOT NULL;
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expense_monthly_payments__insert" AFTER INSERT ON "recurring_expense_monthly_payments" FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'INSERT', 'recurring_expense_monthly_payments', NEW.id, NULL, json_object('id', NEW."id", 'recurring_expense_id', NEW."recurring_expense_id", 'payment_month', NEW."payment_month", 'payment_year', NEW."payment_year", 'payment_date', NEW."payment_date", 'payment_amount', NEW."payment_amount", 'bank_account_id', NEW."bank_account_id", 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'receipt_path', NEW."receipt_path"));
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expense_monthly_payments__update" AFTER UPDATE ON "recurring_expense_monthly_payments" FOR EACH ROW WHEN json_object('id', OLD."id", 'recurring_expense_id', OLD."recurring_expense_id", 'payment_month', OLD."payment_month", 'payment_year', OLD."payment_year", 'payment_date', OLD."payment_date", 'payment_amount', OLD."payment_amount", 'bank_account_id', OLD."bank_account_id", 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'receipt_path', OLD."receipt_path") IS NOT json_object('id', NEW."id", 'recurring_expense_id', NEW."recurring_expense_id", 'payment_month', NEW."payment_month", 'payment_year', NEW."payment_year", 'payment_date', NEW."payment_date", 'payment_amount', NEW."payment_amount", 'bank_account_id', NEW."bank_account_id", 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'receipt_path', NEW."receipt_path")
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'UPDATE', 'recurring_expense_monthly_payments', NEW.id, json_object('id', OLD."id", 'recurring_expense_id', OLD."recurring_expense_id", 'payment_month', OLD."payment_month", 'payment_year', OLD."payment_year", 'payment_date', OLD."payment_date", 'payment_amount', OLD."payment_amount", 'bank_account_id', OLD."bank_account_id", 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'receipt_path', OLD."receipt_path"), json_object('id', NEW."id", 'recurring_expense_id', NEW."recurring_expense_id", 'payment_month', NEW."payment_month", 'payment_year', NEW."payment_year", 'payment_date', NEW."payment_date", 'payment_amount', NEW."payment_amount", 'bank_account_id', NEW."bank_account_id", 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'receipt_path', NEW."receipt_path"));
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_recurring_expense_monthly_payments__delete" AFTER DELETE ON "recurring_expense_monthly_payments" FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) VALUES ((SELECT v FROM _ctx WHERE k = 'uid'), (SELECT name FROM user_credentials WHERE id = (SELECT v FROM _ctx WHERE k = 'uid')), 'DELETE', 'recurring_expense_monthly_payments', OLD.id, json_object('id', OLD."id", 'recurring_expense_id', OLD."recurring_expense_id", 'payment_month', OLD."payment_month", 'payment_year', OLD."payment_year", 'payment_date', OLD."payment_date", 'payment_amount', OLD."payment_amount", 'bank_account_id', OLD."bank_account_id", 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at", 'receipt_path', OLD."receipt_path"), NULL);
END;
CREATE TRIGGER IF NOT EXISTS "delete_bank_transaction_for_recurring_expense_payment__delete" AFTER DELETE ON "recurring_expense_monthly_payments" FOR EACH ROW
BEGIN
  DELETE FROM bank_transactions WHERE reference_type = 'recurring_expense' AND reference_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS "create_bank_transaction_for_recurring_expense_payment__insert" AFTER INSERT ON "recurring_expense_monthly_payments" FOR EACH ROW
BEGIN
  INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, reference_type, reference_id, transaction_date) SELECT NEW.bank_account_id, 'Despesa Fixa - ' || COALESCE((SELECT name FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'N/A'), NEW.payment_amount, 'expense', COALESCE((SELECT category FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'Despesas Fixas'), 'recurring_expense', NEW.id, NEW.payment_date WHERE NEW.bank_account_id IS NOT NULL;
END;
CREATE TRIGGER IF NOT EXISTS "trg_validate_interstate_transport__insert" BEFORE INSERT ON "interstate_transports" FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'P0001:Status invalido. Use planned, in_transit, completed ou cancelled.') WHERE NEW.status IS NULL OR NEW.status NOT IN ('planned','in_transit','completed','cancelled');
  SELECT RAISE(ABORT, 'P0001:Quilometragem, consumo e capacidade nao podem ser negativos.') WHERE NEW.distance_km < 0 OR NEW.fuel_consumption_kmpl < 0 OR (NEW.vehicle_capacity_kg IS NOT NULL AND NEW.vehicle_capacity_kg < 0);
  SELECT RAISE(ABORT, 'P0001:Valores monetarios nao podem ser negativos.') WHERE NEW.fuel_price_cents < 0 OR NEW.fuel_cost_cents < 0 OR NEW.toll_cents < 0 OR NEW.lodging_cents < 0 OR NEW.meals_cents < 0 OR NEW.daily_rate_cents < 0 OR NEW.maintenance_cents < 0 OR NEW.freight_cents < 0 OR NEW.advance_cents < 0 OR NEW.extra_cents < 0 OR NEW.revenue_cents < 0;
  SELECT RAISE(ABORT, 'P0001:legs deve ser um array JSON.') WHERE json_type(NEW.legs) <> 'array';
  SELECT RAISE(ABORT, 'P0001:helpers deve ser um array JSON.') WHERE json_type(NEW.helpers) <> 'array';
  SELECT RAISE(ABORT, 'P0001:A data de chegada nao pode ser anterior a data de saida.') WHERE NEW.arrival_date IS NOT NULL AND NEW.arrival_date < NEW.transport_date;
  SELECT RAISE(ABORT, 'P0001:A data de retorno nao pode ser anterior a data de saida.') WHERE NEW.expected_return_date IS NOT NULL AND NEW.expected_return_date < NEW.transport_date;
END;
CREATE TRIGGER IF NOT EXISTS "trg_validate_interstate_transport__update" BEFORE UPDATE ON "interstate_transports" FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'P0001:Status invalido. Use planned, in_transit, completed ou cancelled.') WHERE NEW.status IS NOT OLD.status AND (NEW.status IS NULL OR NEW.status NOT IN ('planned','in_transit','completed','cancelled'));
  SELECT RAISE(ABORT, 'P0001:Quilometragem, consumo e capacidade nao podem ser negativos.') WHERE NEW.distance_km < 0 OR NEW.fuel_consumption_kmpl < 0 OR (NEW.vehicle_capacity_kg IS NOT NULL AND NEW.vehicle_capacity_kg < 0);
  SELECT RAISE(ABORT, 'P0001:Valores monetarios nao podem ser negativos.') WHERE NEW.fuel_price_cents < 0 OR NEW.fuel_cost_cents < 0 OR NEW.toll_cents < 0 OR NEW.lodging_cents < 0 OR NEW.meals_cents < 0 OR NEW.daily_rate_cents < 0 OR NEW.maintenance_cents < 0 OR NEW.freight_cents < 0 OR NEW.advance_cents < 0 OR NEW.extra_cents < 0 OR NEW.revenue_cents < 0;
  SELECT RAISE(ABORT, 'P0001:legs deve ser um array JSON.') WHERE json_type(NEW.legs) <> 'array';
  SELECT RAISE(ABORT, 'P0001:helpers deve ser um array JSON.') WHERE json_type(NEW.helpers) <> 'array';
  SELECT RAISE(ABORT, 'P0001:A data de chegada nao pode ser anterior a data de saida.') WHERE NEW.arrival_date IS NOT NULL AND NEW.arrival_date < NEW.transport_date;
  SELECT RAISE(ABORT, 'P0001:A data de retorno nao pode ser anterior a data de saida.') WHERE NEW.expected_return_date IS NOT NULL AND NEW.expected_return_date < NEW.transport_date;
END;
