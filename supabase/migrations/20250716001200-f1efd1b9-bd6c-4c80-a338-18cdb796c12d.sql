-- Resetar os saldos para valores iniciais corretos e simples
UPDATE public.bank_accounts 
SET balance = CASE 
  WHEN name = 'Conta Corrente Principal' THEN 25000.00
  WHEN name = 'Conta Poupança' THEN 15000.00  
  WHEN name = 'Dinheiro em Caixa' THEN 2500.00
  ELSE 0.00
END,
updated_at = now();

-- Criar uma função mais simples que só atualiza quando chamada manualmente
CREATE OR REPLACE FUNCTION public.manual_update_bank_balances()
RETURNS TABLE(account_name TEXT, old_balance DECIMAL, new_balance DECIMAL) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    account_record RECORD;
    income_amount DECIMAL(10,2);
    expense_amount DECIMAL(10,2);
    initial_balance DECIMAL(10,2);
    final_balance DECIMAL(10,2);
BEGIN
    FOR account_record IN SELECT * FROM public.bank_accounts LOOP
        
        -- Saldo inicial fixo
        initial_balance := CASE 
            WHEN account_record.name = 'Conta Corrente Principal' THEN 25000.00
            WHEN account_record.name = 'Conta Poupança' THEN 15000.00
            WHEN account_record.name = 'Dinheiro em Caixa' THEN 2500.00
            ELSE 0.00
        END;
        
        -- Receitas (apenas eventos REALMENTE pagos)
        SELECT COALESCE(SUM(COALESCE(payment_amount, total_budget)), 0) INTO income_amount
        FROM public.events 
        WHERE is_paid = true 
        AND (payment_bank_account = account_record.name OR 
             (payment_bank_account IS NULL AND account_record.name = 'Conta Corrente Principal'));
        
        -- Despesas
        SELECT COALESCE(SUM(total_price), 0) INTO expense_amount
        FROM public.event_expenses 
        WHERE expense_bank_account = account_record.name OR 
              (expense_bank_account IS NULL AND account_record.name = 'Conta Corrente Principal');
        
        final_balance := initial_balance + income_amount - expense_amount;
        
        -- Retornar resultado para debug
        account_name := account_record.name;
        old_balance := account_record.balance;
        new_balance := final_balance;
        RETURN NEXT;
        
        -- Atualizar o saldo
        UPDATE public.bank_accounts 
        SET balance = final_balance, updated_at = now()
        WHERE id = account_record.id;
        
    END LOOP;
END;
$$;