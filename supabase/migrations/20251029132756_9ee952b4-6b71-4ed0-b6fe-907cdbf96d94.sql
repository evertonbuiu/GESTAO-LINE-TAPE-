-- Desabilitar RLS completamente para worker_expense_advances
-- já que o sistema usa autenticação customizada
ALTER TABLE worker_expense_advances DISABLE ROW LEVEL SECURITY;