-- Corrigir a função force_sync_all_balances para funcionar corretamente
DROP FUNCTION IF EXISTS public.force_sync_all_balances();

CREATE OR REPLACE FUNCTION public.force_sync_all_balances()
RETURNS TABLE(
    account_name text, 
    old_balance numeric, 
    new_balance numeric, 
    income_total numeric, 
    expense_total numeric,
    transaction_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Sincronizar transações primeiro
    PERFORM public.sync_bank_transactions();
    
    -- Retornar resultado da atualização dos saldos
    RETURN QUERY
    SELECT * FROM public.update_all_account_balances_from_transactions();
END;
$$;

-- Executar a sincronização forçada para corrigir os saldos
SELECT * FROM public.force_sync_all_balances();