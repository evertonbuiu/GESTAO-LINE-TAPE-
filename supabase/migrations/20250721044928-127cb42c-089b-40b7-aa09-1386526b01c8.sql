-- Desabilitar RLS nas tabelas financeiras e de sistema
ALTER TABLE public.bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;