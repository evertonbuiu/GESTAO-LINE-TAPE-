-- Função para atualizar saldos baseado no extrato de cada conta
CREATE OR REPLACE FUNCTION public.update_account_balances_from_statements()
RETURNS TABLE(account_name text, old_balance numeric, new_balance numeric, transaction_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    account_record RECORD;
    calculated_balance DECIMAL(10,2);
    transaction_count INTEGER;
BEGIN
    -- Para cada conta bancária
    FOR account_record IN SELECT * FROM public.bank_accounts LOOP
        
        -- Calcular saldo baseado no extrato (transações)
        SELECT 
            COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) - 
            COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0),
            COUNT(*)
        INTO calculated_balance, transaction_count
        FROM public.bank_transactions 
        WHERE bank_account_id = account_record.id;
        
        -- Retornar resultado para debug
        account_name := account_record.name;
        old_balance := account_record.balance;
        new_balance := calculated_balance;
        RETURN NEXT;
        
        -- Atualizar o saldo da conta baseado no extrato
        UPDATE public.bank_accounts 
        SET balance = calculated_balance,
            updated_at = now()
        WHERE id = account_record.id;
        
        RAISE NOTICE 'Account %: Old Balance=%, New Balance=%, Transactions=%', 
                     account_record.name, account_record.balance, calculated_balance, transaction_count;
        
    END LOOP;
END;
$$;

-- Trigger para atualizar saldos automaticamente quando transações mudam
CREATE OR REPLACE FUNCTION public.auto_update_account_balance_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    affected_account_id UUID;
    calculated_balance DECIMAL(10,2);
BEGIN
    -- Identificar conta afetada
    affected_account_id := COALESCE(NEW.bank_account_id, OLD.bank_account_id);
    
    -- Calcular novo saldo baseado em todas as transações da conta
    SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
    INTO calculated_balance
    FROM public.bank_transactions 
    WHERE bank_account_id = affected_account_id;
    
    -- Atualizar saldo da conta
    UPDATE public.bank_accounts 
    SET balance = calculated_balance,
        updated_at = now()
    WHERE id = affected_account_id;
    
    RAISE NOTICE 'Auto-updated account balance: Account ID=%, New Balance=%', 
                 affected_account_id, calculated_balance;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se existir
DROP TRIGGER IF EXISTS auto_update_balance_on_transaction ON public.bank_transactions;

-- Criar trigger para atualização automática
CREATE TRIGGER auto_update_balance_on_transaction
    AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_update_account_balance_on_transaction();