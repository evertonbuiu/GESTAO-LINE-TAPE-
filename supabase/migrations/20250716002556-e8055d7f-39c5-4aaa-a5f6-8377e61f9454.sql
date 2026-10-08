-- Criar triggers automáticos para sincronizar transações

-- Trigger para eventos (quando pagamento é marcado/desmarcado)
CREATE OR REPLACE FUNCTION public.sync_transactions_on_event_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sincronizar transações após mudança em evento
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para despesas (quando despesa é adicionada/removida/editada)
CREATE OR REPLACE FUNCTION public.sync_transactions_on_expense_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sincronizar transações após mudança em despesa
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar triggers
DROP TRIGGER IF EXISTS events_sync_transactions ON public.events;
CREATE TRIGGER events_sync_transactions
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_transactions_on_event_change();

DROP TRIGGER IF EXISTS expenses_sync_transactions ON public.event_expenses;
CREATE TRIGGER expenses_sync_transactions
    AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_transactions_on_expense_change();

-- Habilitar real-time para a tabela bank_transactions se ainda não estiver
ALTER TABLE public.bank_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;