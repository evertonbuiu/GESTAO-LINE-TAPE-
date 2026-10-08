-- Alinha as regras automáticas com o banco real (Supabase "sistema line tape 2026").
-- Remove regras que existiam só no histórico de migrações (vales e estoque
-- duplicados, manutenção antiga) e cria as duas regras de diárias que o banco
-- real tem mas o histórico não registrava.

DROP TRIGGER IF EXISTS "bank_transactions_balance_update__delete";
DROP TRIGGER IF EXISTS "bank_transactions_balance_update__insert";
DROP TRIGGER IF EXISTS "bank_transactions_balance_update__update";
DROP TRIGGER IF EXISTS "create_transaction_for_advance__insert";
DROP TRIGGER IF EXISTS "create_transaction_for_worker_expense_advance__insert";
DROP TRIGGER IF EXISTS "create_worker_vale_transaction__insert";
DROP TRIGGER IF EXISTS "delete_collaborator_expense_advance_transaction__delete";
DROP TRIGGER IF EXISTS "delete_transaction_for_advance__delete";
DROP TRIGGER IF EXISTS "delete_transaction_for_worker_expense_advance__delete";
DROP TRIGGER IF EXISTS "delete_worker_expense_advance_transaction__delete";
DROP TRIGGER IF EXISTS "delete_worker_vale_transaction__delete";
DROP TRIGGER IF EXISTS "sync_event_team_from_daily_rate_trigger__delete";
DROP TRIGGER IF EXISTS "sync_event_team_from_daily_rate_trigger__insert";
DROP TRIGGER IF EXISTS "sync_event_team_from_daily_rate_trigger__update";
DROP TRIGGER IF EXISTS "trigger_create_collaborator_from_daily_rate__insert";
DROP TRIGGER IF EXISTS "trigger_create_expense_from_daily_rate__insert";
DROP TRIGGER IF EXISTS "trigger_delete_collaborator_from_daily_rate__delete";
DROP TRIGGER IF EXISTS "trigger_delete_expense_from_daily_rate__delete";
DROP TRIGGER IF EXISTS "trigger_update_collaborator_from_daily_rate__update";
DROP TRIGGER IF EXISTS "trigger_update_equipment_maintenance__delete";
DROP TRIGGER IF EXISTS "trigger_update_equipment_maintenance__insert";
DROP TRIGGER IF EXISTS "trigger_update_equipment_maintenance__update";
DROP TRIGGER IF EXISTS "trigger_update_equipment_on_maintenance_change__delete";
DROP TRIGGER IF EXISTS "trigger_update_equipment_on_maintenance_change__insert";
DROP TRIGGER IF EXISTS "trigger_update_equipment_on_maintenance_change__update";
DROP TRIGGER IF EXISTS "trigger_update_equipment_stock__delete";
DROP TRIGGER IF EXISTS "trigger_update_equipment_stock__insert";
DROP TRIGGER IF EXISTS "trigger_update_equipment_stock__update";
DROP TRIGGER IF EXISTS "trigger_update_expense_from_daily_rate__update";
DROP TRIGGER IF EXISTS "update_collaborator_vale_transaction__update";
DROP TRIGGER IF EXISTS "update_transaction_for_advance__update";
DROP TRIGGER IF EXISTS "update_transaction_for_worker_expense_advance__update";
DROP TRIGGER IF EXISTS "update_worker_vale_transaction__update";

-- create_event_collaborator_from_daily_rate (AFTER INSERT ON daily_rates)
CREATE TRIGGER IF NOT EXISTS "create_event_collaborator_from_daily_rate_trigger__insert" AFTER INSERT ON "daily_rates" FOR EACH ROW
WHEN NEW.event_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM event_collaborators WHERE reference_type = 'daily_rate' AND reference_id = NEW.id)
BEGIN
  INSERT INTO event_collaborators (event_id, collaborator_name, collaborator_email, role, reference_type, reference_id, assigned_by)
  VALUES (NEW.event_id, NEW.worker_name, '', 'diarista', 'daily_rate', NEW.id, NEW.created_by);
END;

-- delete_event_collaborator_from_daily_rate (AFTER DELETE ON daily_rates)
CREATE TRIGGER IF NOT EXISTS "delete_event_collaborator_from_daily_rate_trigger__delete" AFTER DELETE ON "daily_rates" FOR EACH ROW
BEGIN
  DELETE FROM event_collaborators WHERE reference_type = 'daily_rate' AND reference_id = OLD.id;
END;

-- Nomes repetidos em tabelas diferentes (worker_advances e worker_expense_advances):
-- no D1 só a primeira era criada. Agora cada uma tem nome próprio.
DROP TRIGGER IF EXISTS "create_worker_advance_transaction__insert";
DROP TRIGGER IF EXISTS "delete_worker_advance_transaction__delete";
CREATE TRIGGER IF NOT EXISTS "worker_expense_advances__delete_worker_advance_transaction__delete" AFTER DELETE ON "worker_expense_advances" FOR EACH ROW
BEGIN
  DELETE FROM bank_transactions WHERE reference_type = 'worker_advance' AND reference_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS "worker_expense_advances__create_worker_advance_transaction__insert" AFTER INSERT ON "worker_expense_advances" FOR EACH ROW
BEGIN
  INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, reference_type, reference_id, transaction_date) SELECT NEW.bank_account_id, 'Adiantamento - ' || NEW.worker_name, NEW.amount, 'expense', 'Adiantamentos de Diaristas', 'worker_advance', NEW.id, NEW.advance_date;
END;
CREATE TRIGGER IF NOT EXISTS "worker_advances__delete_worker_advance_transaction__delete" AFTER DELETE ON "worker_advances" FOR EACH ROW
BEGIN
  DELETE FROM bank_transactions WHERE reference_type = 'worker_advance' AND reference_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS "worker_advances__create_worker_advance_transaction__insert" AFTER INSERT ON "worker_advances" FOR EACH ROW
BEGIN
  INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, reference_type, reference_id, transaction_date) SELECT NEW.bank_account_id, 'Vale Diarista: ' || NEW.worker_name, NEW.amount, 'expense', 'Vale Diarista', 'worker_advance', NEW.id, NEW.advance_date WHERE NEW.bank_account_id IS NOT NULL;
END;
