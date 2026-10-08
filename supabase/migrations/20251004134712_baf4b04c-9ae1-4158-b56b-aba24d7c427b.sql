-- Atualizar função sync_bank_transactions para incluir pagamentos restantes
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
    monthly_payment_record RECORD;
    fixed_expense_record RECORD;
    account_id UUID;
BEGIN
    -- Limpar transações existentes de referência automática
    DELETE FROM public.bank_transactions 
    WHERE reference_type IN ('event', 'event_remaining', 'expense', 'recurring_expense', 'monthly_payment', 'company_fixed_expense');
    
    -- Inserir transações de eventos pagos (apenas com payment_bank_account explícito e não vazio)
    FOR event_record IN 
        SELECT * FROM public.events 
        WHERE is_paid = true 
        AND payment_bank_account IS NOT NULL 
        AND payment_bank_account != ''
        AND TRIM(payment_bank_account) != ''
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
                account_id, 
                CASE 
                    WHEN event_record.payment_type = 'entrada' THEN 'Receita (Entrada) - ' || event_record.name
                    ELSE 'Receita - ' || event_record.name
                END,
                COALESCE(event_record.payment_amount, event_record.total_budget, 0),
                'income', 'Receita de Eventos', 'event', event_record.id,
                COALESCE(event_record.payment_date::date, event_record.event_date)
            );
        END IF;
        
        -- Inserir transação do pagamento restante se houver
        IF event_record.payment_type = 'entrada' 
           AND event_record.is_remaining_paid = true 
           AND event_record.remaining_payment_bank_account IS NOT NULL
           AND TRIM(event_record.remaining_payment_bank_account) != '' THEN
            
            SELECT id INTO account_id 
            FROM public.bank_accounts 
            WHERE name = event_record.remaining_payment_bank_account
            LIMIT 1;
            
            IF account_id IS NOT NULL THEN
                INSERT INTO public.bank_transactions (
                    bank_account_id, description, amount, transaction_type, category,
                    reference_type, reference_id, transaction_date
                ) VALUES (
                    account_id, 
                    'Receita (Restante) - ' || event_record.name,
                    COALESCE(event_record.remaining_payment_amount, 0),
                    'income', 'Receita de Eventos', 'event_remaining', event_record.id,
                    event_record.remaining_payment_date
                );
            END IF;
        END IF;
    END LOOP;
    
    -- Inserir transações de despesas de eventos (APENAS com expense_bank_account explícito e não vazio)
    FOR expense_record IN 
        SELECT * FROM public.event_expenses 
        WHERE expense_bank_account IS NOT NULL 
        AND expense_bank_account != ''
        AND TRIM(expense_bank_account) != ''
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

    -- Inserir transações de despesas da empresa (APENAS com expense_bank_account explícito e não vazio)
    FOR expense_record IN 
        SELECT * FROM public.company_expenses 
        WHERE expense_bank_account IS NOT NULL 
        AND expense_bank_account != ''
        AND TRIM(expense_bank_account) != ''
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
    
    -- Inserir transações de despesas fixas pagas (APENAS com payment_bank_account explícito e não vazio)
    FOR recurring_expense_record IN 
        SELECT * FROM public.recurring_expenses 
        WHERE is_paid = true 
        AND payment_date IS NOT NULL 
        AND payment_bank_account IS NOT NULL 
        AND payment_bank_account != ''
        AND TRIM(payment_bank_account) != ''
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
    
    -- Inserir transações de pagamentos mensais de despesas fixas
    FOR monthly_payment_record IN 
        SELECT rmp.*, re.name as expense_name, re.category as expense_category
        FROM public.recurring_expense_monthly_payments rmp
        LEFT JOIN public.recurring_expenses re ON re.id = rmp.recurring_expense_id
        WHERE rmp.bank_account_id IS NOT NULL
    LOOP
        -- Usar diretamente o bank_account_id já que é UUID na tabela monthly_payments
        INSERT INTO public.bank_transactions (
            bank_account_id, description, amount, transaction_type, category,
            reference_type, reference_id, transaction_date
        ) VALUES (
            monthly_payment_record.bank_account_id, 
            'Despesa Fixa Mensal - ' || COALESCE(monthly_payment_record.expense_name, 'Despesa'),
            monthly_payment_record.payment_amount, 
            'expense',
            COALESCE(monthly_payment_record.expense_category, 'Despesas Fixas'), 
            'monthly_payment', 
            monthly_payment_record.id,
            monthly_payment_record.payment_date
        );
    END LOOP;

    -- Inserir transações de gastos fixos da empresa pagos
    FOR fixed_expense_record IN 
        SELECT cfmp.*
        FROM public.company_fixed_expense_monthly_payments cfmp
        WHERE cfmp.bank_account_id IS NOT NULL
    LOOP
        INSERT INTO public.bank_transactions (
            bank_account_id, description, amount, transaction_type, category,
            reference_type, reference_id, transaction_date
        ) VALUES (
            fixed_expense_record.bank_account_id, 
            'Gasto Fixo Empresa - ' || fixed_expense_record.category,
            fixed_expense_record.payment_amount, 
            'expense',
            fixed_expense_record.category, 
            'company_fixed_expense', 
            fixed_expense_record.id,
            fixed_expense_record.payment_date
        );
    END LOOP;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in sync_bank_transactions: %', SQLERRM;
END;
$function$;