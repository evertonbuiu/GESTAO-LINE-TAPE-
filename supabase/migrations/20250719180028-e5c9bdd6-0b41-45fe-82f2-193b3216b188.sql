-- Corrigir função de sincronização - eventos pagos são saídas de dinheiro
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
    
    -- Sincronizar eventos pagos como SAÍDAS (despesas)
    -- Quando pagamos um evento, o dinheiro SAI da nossa conta
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
                'Pagamento Evento - ' || event_record.name,
                COALESCE(event_record.payment_amount, event_record.total_budget, 0),
                'expense', -- MUDANÇA: eventos pagos são despesas (saída de dinheiro)
                'Pagamento de Eventos',
                'event',
                event_record.id,
                COALESCE(event_record.payment_date::date, event_record.event_date)
            );
        END IF;
    END LOOP;
    
    -- Sincronizar despesas (gastos que tivemos)
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
                'Despesa - ' || COALESCE(expense_record.description, 'Despesa'),
                COALESCE(expense_record.total_price, 0),
                'expense', -- Despesas são saídas de dinheiro
                COALESCE(expense_record.category, 'Outros'),
                'expense',
                expense_record.id,
                expense_record.created_at::date
            );
        END IF;
    END LOOP;

    -- Sincronizar despesas da empresa
    FOR expense_record IN 
        SELECT * FROM public.company_expenses 
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
                'Despesa Empresa - ' || COALESCE(expense_record.description, 'Despesa'),
                COALESCE(expense_record.total_price, 0),
                'expense', -- Despesas da empresa são saídas de dinheiro
                COALESCE(expense_record.category, 'Outros'),
                'expense',
                expense_record.id,
                COALESCE(expense_record.expense_date, expense_record.created_at::date)
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