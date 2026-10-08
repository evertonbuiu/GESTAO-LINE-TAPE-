-- Função para forçar sincronização completa dos saldos
CREATE OR REPLACE FUNCTION public.force_sync_all_balances()
RETURNS TABLE(account_name text, old_balance numeric, new_balance numeric, income_total numeric, expense_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Primeiro, sincronizar todas as transações
    PERFORM public.sync_bank_transactions();
    
    -- Depois, retornar o resultado da atualização de saldos
    RETURN QUERY
    SELECT * FROM public.update_all_account_balances_from_transactions();
END;
$$;