-- Habilitar real-time para bank_transactions
ALTER TABLE public.bank_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;