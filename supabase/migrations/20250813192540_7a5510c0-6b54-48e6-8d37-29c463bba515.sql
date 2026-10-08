-- Atualizar função sync_bank_transactions para incluir despesas fixas pagas
CREATE OR REPLACE FUNCTION public.sync_bank_transactions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    event_record RECORD;
    expense_record RECORD;
    recurring_expense_record RECORD;
    account_id UUID;
BEGIN
    -- Limpar transações existentes de referência automática
    DELETE FROM public.bank_transactions 
    WHERE reference_type IN ('event', 'expense', 'recurring_expense');
    
    -- Inserir transações de eventos pagos
    FOR event_record IN 
        SELECT * FROM public.events WHERE is_paid = true 
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(event_record.payment_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id, description, amount, transaction_type, category,
                reference_type, reference_id, transaction_date
            ) VALUES (
                account_id, 'Receita - ' || event_record.name,
                COALESCE(event_record.payment_amount, event_record.total_budget, 0),
                'income', 'Receita de Eventos', 'event', event_record.id,
                COALESCE(event_record.payment_date::date, event_record.event_date)
            );
        END IF;
    END LOOP;
    
    -- Inserir transações de despesas de eventos
    FOR expense_record IN SELECT * FROM public.event_expenses LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(expense_record.expense_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id, description, amount, transaction_type, category,
                reference_type, reference_id, transaction_date
            ) VALUES (
                account_id, 'Despesa - ' || COALESCE(expense_record.description, 'Despesa'),
                COALESCE(expense_record.total_price, 0), 'expense',
                COALESCE(expense_record.category, 'Outros'), 'expense', expense_record.id,
                COALESCE(expense_record.expense_date, expense_record.created_at::date)
            );
        END IF;
    END LOOP;

    -- Inserir transações de despesas da empresa
    FOR expense_record IN SELECT * FROM public.company_expenses LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(expense_record.expense_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id, description, amount, transaction_type, category,
                reference_type, reference_id, transaction_date
            ) VALUES (
                account_id, 'Despesa Empresa - ' || COALESCE(expense_record.description, 'Despesa'),
                COALESCE(expense_record.total_price, 0), 'expense',
                COALESCE(expense_record.category, 'Outros'), 'expense', expense_record.id,
                COALESCE(expense_record.expense_date, expense_record.created_at::date)
            );
        END IF;
    END LOOP;
    
    -- NOVA SEÇÃO: Inserir transações de despesas fixas pagas
    FOR recurring_expense_record IN 
        SELECT * FROM public.recurring_expenses WHERE is_paid = true AND payment_date IS NOT NULL
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = COALESCE(recurring_expense_record.payment_bank_account, 'Conta Corrente Principal')
        LIMIT 1;
        
        IF account_id IS NOT NULL THEN
            INSERT INTO public.bank_transactions (
                bank_account_id, description, amount, transaction_type, category,
                reference_type, reference_id, transaction_date
            ) VALUES (
                account_id, 'Despesa Fixa - ' || recurring_expense_record.name,
                recurring_expense_record.amount, 'expense',
                COALESCE(recurring_expense_record.category, 'Despesas Fixas'), 
                'recurring_expense', recurring_expense_record.id,
                recurring_expense_record.payment_date
            );
        END IF;
    END LOOP;
    
    -- Atualizar saldos das contas baseado nas transações
    UPDATE public.bank_accounts 
    SET balance = public.calculate_balance_from_transactions(id), updated_at = now()
    WHERE id IS NOT NULL;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in sync_bank_transactions: %', SQLERRM;
END;
$function$;

-- Criar trigger para sincronizar automaticamente quando despesas fixas forem marcadas como pagas
CREATE OR REPLACE FUNCTION public.auto_sync_transactions_on_recurring_expense_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Executar sincronização automática quando despesas fixas são modificadas
    PERFORM public.sync_bank_transactions();
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Criar o trigger na tabela recurring_expenses
DROP TRIGGER IF EXISTS trigger_sync_transactions_on_recurring_expense_change ON public.recurring_expenses;
CREATE TRIGGER trigger_sync_transactions_on_recurring_expense_change
    AFTER INSERT OR UPDATE OR DELETE ON public.recurring_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_transactions_on_recurring_expense_change();