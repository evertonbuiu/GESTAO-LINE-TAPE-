-- Corrigir os triggers para evitar UPDATE sem WHERE
CREATE OR REPLACE FUNCTION public.sync_transactions_on_event_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Só executar se não for DELETE ou se houver NEW record
    IF TG_OP = 'DELETE' OR NEW IS NOT NULL THEN
        -- Sincronizar transações após mudança em evento
        PERFORM public.sync_bank_transactions();
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_transactions_on_expense_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Só executar se não for DELETE ou se houver NEW record
    IF TG_OP = 'DELETE' OR NEW IS NOT NULL THEN
        -- Sincronizar transações após mudança em despesa
        PERFORM public.sync_bank_transactions();
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear a função de sincronização com tratamento de erro melhor
CREATE OR REPLACE FUNCTION public.sync_bank_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    event_record RECORD;
    expense_record RECORD;
    account_id UUID;
BEGIN
    -- Limpar transações automáticas existentes
    DELETE FROM public.bank_transactions 
    WHERE reference_type IN ('event', 'expense');
    
    -- Sincronizar eventos pagos como receitas
    FOR event_record IN 
        SELECT * FROM public.events WHERE is_paid = true 
    LOOP
        -- Encontrar o ID da conta bancária
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(event_record.payment_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id,
                description,
                amount,
                transaction_type,
                category,
                reference_type,
                reference_id,
                transaction_date
            ) VALUES (
                account_id,
                'Receita - ' || event_record.name,
                COALESCE(event_record.payment_amount, event_record.total_budget, 0),
                'income',
                'Receita de Eventos',
                'event',
                event_record.id,
                COALESCE(event_record.payment_date::date, event_record.event_date)
            );
        END IF;
    END LOOP;
    
    -- Sincronizar despesas
    FOR expense_record IN 
        SELECT * FROM public.event_expenses 
    LOOP
        -- Encontrar o ID da conta bancária
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(expense_record.expense_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id,
                description,
                amount,
                transaction_type,
                category,
                reference_type,
                reference_id,
                transaction_date
            ) VALUES (
                account_id,
                COALESCE(expense_record.description, 'Despesa'),
                COALESCE(expense_record.total_price, 0),
                'expense',
                COALESCE(expense_record.category, 'Outros'),
                'expense',
                expense_record.id,
                expense_record.created_at::date
            );
        END IF;
    END LOOP;
    
    -- Atualizar saldos de todas as contas baseado nas transações
    UPDATE public.bank_accounts 
    SET balance = public.calculate_balance_from_transactions(id),
        updated_at = now()
    WHERE id IS NOT NULL;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in sync_bank_transactions: %', SQLERRM;
END;
$$;