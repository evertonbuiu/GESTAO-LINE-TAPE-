
-- Habilitar real-time para a tabela bank_accounts
ALTER TABLE public.bank_accounts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
