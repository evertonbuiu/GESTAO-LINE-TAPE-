-- Resetar todos os saldos para zero
UPDATE public.bank_accounts 
SET balance = 0.00, updated_at = now();

-- Função simples para calcular saldos baseado apenas em eventos e despesas
CREATE OR REPLACE FUNCTION public.calculate_account_balance(account_name_param TEXT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_income DECIMAL(10,2) := 0;
    total_expenses DECIMAL(10,2) := 0;
    final_balance DECIMAL(10,2);
BEGIN
    -- Calcular receitas (eventos marcados como pagos)
    SELECT COALESCE(SUM(COALESCE(payment_amount, total_budget)), 0) INTO total_income
    FROM public.events 
    WHERE is_paid = true 
    AND (payment_bank_account = account_name_param OR 
         (payment_bank_account IS NULL AND account_name_param = 'Conta Corrente Principal'));
    
    -- Calcular despesas
    SELECT COALESCE(SUM(total_price), 0) INTO total_expenses
    FROM public.event_expenses 
    WHERE expense_bank_account = account_name_param OR 
          (expense_bank_account IS NULL AND account_name_param = 'Conta Corrente Principal');
    
    final_balance := total_income - total_expenses;
    
    RETURN final_balance;
END;
$$;

-- Função para atualizar uma conta específica
CREATE OR REPLACE FUNCTION public.update_single_account_balance(account_name_param TEXT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance DECIMAL(10,2);
BEGIN
    -- Calcular novo saldo
    new_balance := public.calculate_account_balance(account_name_param);
    
    -- Atualizar a conta
    UPDATE public.bank_accounts 
    SET balance = new_balance, updated_at = now()
    WHERE name = account_name_param;
    
    RETURN new_balance;
END;
$$;