-- Função para atualizar todos os saldos baseado nos extratos
CREATE OR REPLACE FUNCTION public.update_all_account_balances_from_transactions()
RETURNS TABLE(
    account_name TEXT,
    old_balance DECIMAL(10,2),
    new_balance DECIMAL(10,2),
    total_income DECIMAL(10,2),
    total_expenses DECIMAL(10,2),
    transaction_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    account_record RECORD;
    income_sum DECIMAL(10,2);
    expense_sum DECIMAL(10,2);
    calculated_balance DECIMAL(10,2);
    transaction_count INTEGER;
BEGIN
    -- Para cada conta bancária
    FOR account_record IN SELECT * FROM public.bank_accounts LOOP
        
        -- Calcular receitas desta conta
        SELECT COALESCE(SUM(amount), 0) INTO income_sum
        FROM public.bank_transactions 
        WHERE bank_account_id = account_record.id 
        AND transaction_type = 'income';
        
        -- Calcular despesas desta conta
        SELECT COALESCE(SUM(amount), 0) INTO expense_sum
        FROM public.bank_transactions 
        WHERE bank_account_id = account_record.id 
        AND transaction_type = 'expense';
        
        -- Contar transações
        SELECT COUNT(*) INTO transaction_count
        FROM public.bank_transactions 
        WHERE bank_account_id = account_record.id;
        
        -- Calcular novo saldo
        calculated_balance := income_sum - expense_sum;
        
        -- Retornar resultado para debug
        account_name := account_record.name;
        old_balance := account_record.balance;
        new_balance := calculated_balance;
        total_income := income_sum;
        total_expenses := expense_sum;
        RETURN NEXT;
        
        -- Atualizar o saldo da conta
        UPDATE public.bank_accounts 
        SET balance = calculated_balance,
            updated_at = now()
        WHERE id = account_record.id;
        
    END LOOP;
END;
$$;

-- Função para obter extrato detalhado de uma conta
CREATE OR REPLACE FUNCTION public.get_account_statement(account_name_param TEXT)
RETURNS TABLE(
    transaction_date DATE,
    description TEXT,
    amount DECIMAL(10,2),
    transaction_type TEXT,
    category TEXT,
    running_balance DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    account_id UUID;
    running_total DECIMAL(10,2) := 0;
    transaction_record RECORD;
BEGIN
    -- Encontrar ID da conta
    SELECT id INTO account_id 
    FROM public.bank_accounts 
    WHERE name = account_name_param;
    
    IF account_id IS NULL THEN
        RAISE EXCEPTION 'Account not found: %', account_name_param;
    END IF;
    
    -- Retornar transações ordenadas por data
    FOR transaction_record IN
        SELECT bt.transaction_date, bt.description, bt.amount, bt.transaction_type, bt.category
        FROM public.bank_transactions bt
        WHERE bt.bank_account_id = account_id
        ORDER BY bt.transaction_date ASC, bt.created_at ASC
    LOOP
        -- Calcular saldo acumulado
        IF transaction_record.transaction_type = 'income' THEN
            running_total := running_total + transaction_record.amount;
        ELSE
            running_total := running_total - transaction_record.amount;
        END IF;
        
        -- Retornar linha do extrato
        transaction_date := transaction_record.transaction_date;
        description := transaction_record.description;
        amount := transaction_record.amount;
        transaction_type := transaction_record.transaction_type;
        category := transaction_record.category;
        running_balance := running_total;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Executar atualização completa
SELECT public.sync_bank_transactions();
SELECT * FROM public.update_all_account_balances_from_transactions();