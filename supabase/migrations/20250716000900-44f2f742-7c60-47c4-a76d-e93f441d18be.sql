-- Corrigir a função para calcular saldos corretamente
CREATE OR REPLACE FUNCTION public.update_bank_account_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    account_record RECORD;
    total_income DECIMAL(10,2);
    total_expenses DECIMAL(10,2);
    calculated_balance DECIMAL(10,2);
    initial_balance DECIMAL(10,2);
BEGIN
    -- Para cada conta bancária
    FOR account_record IN SELECT * FROM public.bank_accounts LOOP
        
        -- Calcular receitas desta conta (eventos pagos)
        SELECT COALESCE(SUM(
            CASE 
                WHEN payment_amount > 0 THEN payment_amount 
                ELSE total_budget 
            END
        ), 0) INTO total_income
        FROM public.events 
        WHERE is_paid = true 
        AND (payment_bank_account = account_record.name OR 
             (payment_bank_account IS NULL AND account_record.name = 'Conta Corrente Principal'));
        
        -- Calcular despesas desta conta
        SELECT COALESCE(SUM(total_price), 0) INTO total_expenses
        FROM public.event_expenses 
        WHERE expense_bank_account = account_record.name OR 
              (expense_bank_account IS NULL AND account_record.name = 'Conta Corrente Principal');
        
        -- Definir saldo inicial baseado no tipo de conta (apenas uma vez)
        initial_balance := 0;
        IF account_record.name = 'Conta Corrente Principal' THEN
            initial_balance := 25000.00;
        ELSIF account_record.name = 'Conta Poupança' THEN
            initial_balance := 15000.00;
        ELSIF account_record.name = 'Dinheiro em Caixa' THEN
            initial_balance := 2500.00;
        END IF;
        
        -- Calcular saldo final: saldo inicial + receitas - despesas
        calculated_balance := initial_balance + total_income - total_expenses;
        
        -- Atualizar o saldo da conta
        UPDATE public.bank_accounts 
        SET balance = calculated_balance,
            updated_at = now()
        WHERE id = account_record.id;
        
        RAISE NOTICE 'Account %: Initial=%, Income=%, Expenses=%, Final Balance=%', 
                     account_record.name, initial_balance, total_income, total_expenses, calculated_balance;
    END LOOP;
END;
$$;

-- Executar a função uma vez para corrigir os saldos atuais
SELECT public.update_bank_account_balances();