-- Corrigir função de sincronização para usar TRIM/LOWER na comparação de nomes de contas
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
    -- Limpar transações automáticas existentes (apenas as de reference_type 'event' e 'expense')
    DELETE FROM public.bank_transactions 
    WHERE reference_type IN ('event', 'expense', 'event_remaining');
    
    -- Sincronizar eventos pagos como receitas (pagamento principal)
    FOR event_record IN 
        SELECT * FROM public.events WHERE is_paid = true AND payment_amount > 0
    LOOP
        -- Encontrar o ID da conta bancária usando TRIM e LOWER para comparação
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE TRIM(LOWER(name)) = TRIM(LOWER(COALESCE(event_record.payment_bank_account, 'Conta Corrente Principal')))
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
                'Receita - ' || event_record.name || ' (' || COALESCE(event_record.client_name, 'Cliente') || ')',
                event_record.payment_amount,
                'income',
                'Receita de Eventos',
                'event',
                event_record.id,
                COALESCE(event_record.payment_date::date, event_record.event_date)
            );
        END IF;
    END LOOP;
    
    -- Sincronizar pagamentos restantes de eventos
    FOR event_record IN 
        SELECT * FROM public.events WHERE is_remaining_paid = true AND remaining_payment_amount > 0
    LOOP
        -- Encontrar o ID da conta bancária
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE TRIM(LOWER(name)) = TRIM(LOWER(COALESCE(event_record.remaining_payment_bank_account, 'Conta Corrente Principal')))
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
                'Restante - ' || event_record.name || ' (' || COALESCE(event_record.client_name, 'Cliente') || ')',
                event_record.remaining_payment_amount,
                'income',
                'Receita de Eventos',
                'event_remaining',
                event_record.id,
                COALESCE(event_record.remaining_payment_date::date, event_record.event_date)
            );
        END IF;
    END LOOP;
    
    -- Sincronizar despesas de eventos que têm conta bancária vinculada
    FOR expense_record IN 
        SELECT ee.*, e.name as event_name 
        FROM public.event_expenses ee
        LEFT JOIN public.events e ON ee.event_id = e.id
        WHERE ee.expense_bank_account IS NOT NULL 
          AND ee.expense_bank_account != ''
          AND ee.total_price > 0
    LOOP
        -- Encontrar o ID da conta bancária
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE TRIM(LOWER(name)) = TRIM(LOWER(expense_record.expense_bank_account))
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
                COALESCE(expense_record.description, 'Despesa') || COALESCE(' - ' || expense_record.event_name, ''),
                expense_record.total_price,
                'expense',
                COALESCE(expense_record.category, 'Despesas Evento'),
                'expense',
                expense_record.id,
                COALESCE(expense_record.expense_date::date, expense_record.created_at::date)
            );
        END IF;
    END LOOP;
    
    -- Atualizar saldos de todas as contas baseado nas transações
    UPDATE public.bank_accounts 
    SET balance = (
        SELECT COALESCE(SUM(CASE WHEN bt.transaction_type = 'income' THEN bt.amount ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN bt.transaction_type = 'expense' THEN bt.amount ELSE 0 END), 0)
        FROM public.bank_transactions bt
        WHERE bt.bank_account_id = bank_accounts.id
    ),
    updated_at = now();
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in sync_bank_transactions: %', SQLERRM;
END;
$$;

-- Executar sincronização imediatamente para corrigir os dados
SELECT public.sync_bank_transactions();