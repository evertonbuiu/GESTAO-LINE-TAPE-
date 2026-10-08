-- Função para recalcular automaticamente os saldos das contas bancárias
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
        
        -- Calcular saldo baseado em saldo inicial + receitas - despesas
        -- Assumindo que o saldo inicial estava correto quando a conta foi criada
        calculated_balance := total_income - total_expenses;
        
        -- Se a conta for "Conta Corrente Principal", usar um saldo base padrão
        IF account_record.name = 'Conta Corrente Principal' THEN
            calculated_balance := calculated_balance + 25000.00; -- Saldo inicial padrão
        ELSIF account_record.name = 'Conta Poupança' THEN
            calculated_balance := calculated_balance + 15000.00; -- Saldo inicial padrão
        ELSIF account_record.name = 'Dinheiro em Caixa' THEN
            calculated_balance := calculated_balance + 2500.00; -- Saldo inicial padrão
        END IF;
        
        -- Atualizar o saldo da conta
        UPDATE public.bank_accounts 
        SET balance = calculated_balance,
            updated_at = now()
        WHERE id = account_record.id;
        
        RAISE NOTICE 'Updated account %: Income=%, Expenses=%, Balance=%', 
                     account_record.name, total_income, total_expenses, calculated_balance;
    END LOOP;
END;
$$;

-- Criar triggers para atualizar automaticamente os saldos
CREATE OR REPLACE FUNCTION public.trigger_update_bank_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Atualizar saldos das contas após mudanças
    PERFORM public.update_bank_account_balances();
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para eventos (quando pagamento é marcado/desmarcado)
DROP TRIGGER IF EXISTS events_balance_update ON public.events;
CREATE TRIGGER events_balance_update
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_bank_balances();

-- Trigger para despesas (quando despesas são adicionadas/removidas)
DROP TRIGGER IF EXISTS expenses_balance_update ON public.event_expenses;
CREATE TRIGGER expenses_balance_update
    AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_bank_balances();