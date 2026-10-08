-- Corrigir função de sincronização para não processar eventos sem conta definida
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
    
    -- Inserir transações de eventos pagos (apenas com payment_bank_account explícito)
    FOR event_record IN 
        SELECT * FROM public.events 
        WHERE is_paid = true 
        AND payment_bank_account IS NOT NULL 
        AND payment_bank_account != ''
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = event_record.payment_bank_account
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
    
    -- Inserir transações de despesas de eventos (apenas com expense_bank_account explícito)
    FOR expense_record IN 
        SELECT * FROM public.event_expenses 
        WHERE expense_bank_account IS NOT NULL 
        AND expense_bank_account != ''
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = expense_record.expense_bank_account
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

    -- Inserir transações de despesas da empresa (apenas com expense_bank_account explícito)
    FOR expense_record IN 
        SELECT * FROM public.company_expenses 
        WHERE expense_bank_account IS NOT NULL 
        AND expense_bank_account != ''
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = expense_record.expense_bank_account
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
    
    -- Inserir transações de despesas fixas pagas (apenas com payment_bank_account explícito)
    FOR recurring_expense_record IN 
        SELECT * FROM public.recurring_expenses 
        WHERE is_paid = true 
        AND payment_date IS NOT NULL 
        AND payment_bank_account IS NOT NULL 
        AND payment_bank_account != ''
    LOOP
        SELECT id INTO account_id 
        FROM public.bank_accounts 
        WHERE name = recurring_expense_record.payment_bank_account
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
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in sync_bank_transactions: %', SQLERRM;
END;
$function$;