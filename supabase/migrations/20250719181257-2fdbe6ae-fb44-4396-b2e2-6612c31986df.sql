-- Triggers para sincronização automática do extrato

-- Trigger para quando eventos mudam (marcados como pagos/não pagos)
CREATE OR REPLACE FUNCTION public.auto_sync_transactions_on_event_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Executar sincronização automática
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para quando despesas de eventos mudam
CREATE OR REPLACE FUNCTION public.auto_sync_transactions_on_expense_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Executar sincronização automática
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para quando despesas da empresa mudam
CREATE OR REPLACE FUNCTION public.auto_sync_transactions_on_company_expense_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Executar sincronização automática
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Remover triggers existentes se existirem
DROP TRIGGER IF EXISTS auto_sync_on_event_change ON public.events;
DROP TRIGGER IF EXISTS auto_sync_on_expense_change ON public.event_expenses;
DROP TRIGGER IF EXISTS auto_sync_on_company_expense_change ON public.company_expenses;

-- Criar triggers para eventos
CREATE TRIGGER auto_sync_on_event_change
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_transactions_on_event_change();

-- Criar triggers para despesas de eventos
CREATE TRIGGER auto_sync_on_expense_change
    AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_transactions_on_expense_change();

-- Criar triggers para despesas da empresa
CREATE TRIGGER auto_sync_on_company_expense_change
    AFTER INSERT OR UPDATE OR DELETE ON public.company_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_transactions_on_company_expense_change();