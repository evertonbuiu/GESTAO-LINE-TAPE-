-- Criar tabela de transações bancárias (extrato de cada conta)
CREATE TABLE public.bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category TEXT,
  reference_type TEXT CHECK (reference_type IN ('event', 'expense', 'manual')),
  reference_id UUID, -- ID do evento ou despesa relacionada
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view bank transactions" 
ON public.bank_transactions 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage bank transactions" 
ON public.bank_transactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Função para calcular saldo baseado nas transações do extrato
CREATE OR REPLACE FUNCTION public.calculate_balance_from_transactions(account_id_param UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_income DECIMAL(10,2) := 0;
    total_expenses DECIMAL(10,2) := 0;
    final_balance DECIMAL(10,2);
BEGIN
    -- Somar receitas
    SELECT COALESCE(SUM(amount), 0) INTO total_income
    FROM public.bank_transactions 
    WHERE bank_account_id = account_id_param 
    AND transaction_type = 'income';
    
    -- Somar despesas
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM public.bank_transactions 
    WHERE bank_account_id = account_id_param 
    AND transaction_type = 'expense';
    
    final_balance := total_income - total_expenses;
    
    RETURN final_balance;
END;
$$;

-- Função para sincronizar transações baseado em eventos e despesas
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
        WHERE name = COALESCE(event_record.payment_bank_account, 'Conta Corrente Principal');
        
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
                COALESCE(event_record.payment_amount, event_record.total_budget),
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
        WHERE name = COALESCE(expense_record.expense_bank_account, 'Conta Corrente Principal');
        
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
                expense_record.description,
                expense_record.total_price,
                'expense',
                expense_record.category,
                'expense',
                expense_record.id,
                expense_record.created_at::date
            );
        END IF;
    END LOOP;
    
    -- Atualizar saldos de todas as contas baseado nas transações
    UPDATE public.bank_accounts 
    SET balance = public.calculate_balance_from_transactions(id),
        updated_at = now();
    
END;
$$;

-- Trigger para atualizar saldo quando transação é modificada
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_account_id UUID;
BEGIN
    -- Identificar conta afetada
    affected_account_id := COALESCE(NEW.bank_account_id, OLD.bank_account_id);
    
    -- Atualizar saldo da conta
    UPDATE public.bank_accounts 
    SET balance = public.calculate_balance_from_transactions(affected_account_id),
        updated_at = now()
    WHERE id = affected_account_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger
CREATE TRIGGER bank_transactions_balance_update
    AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_account_balance_on_transaction_change();

-- Sincronizar dados iniciais
SELECT public.sync_bank_transactions();