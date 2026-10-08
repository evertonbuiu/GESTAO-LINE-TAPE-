
-- Criar trigger para criar transação bancária quando um pagamento de despesa fixa é registrado
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_recurring_expense_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expense_name TEXT;
  expense_category TEXT;
BEGIN
  -- Buscar nome e categoria da despesa
  SELECT name, category INTO expense_name, expense_category
  FROM public.recurring_expenses
  WHERE id = NEW.recurring_expense_id;
  
  -- Só criar transação se houver conta bancária associada
  IF NEW.bank_account_id IS NOT NULL THEN
    INSERT INTO public.bank_transactions (
      bank_account_id,
      transaction_type,
      amount,
      description,
      transaction_date,
      category,
      reference_type,
      reference_id
    ) VALUES (
      NEW.bank_account_id,
      'expense',
      NEW.payment_amount,
      'Despesa Fixa - ' || COALESCE(expense_name, 'N/A'),
      NEW.payment_date,
      COALESCE(expense_category, 'Despesas Fixas'),
      'recurring_expense',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar transação quando pagamento é editado
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_recurring_expense_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expense_name TEXT;
  expense_category TEXT;
BEGIN
  -- Deletar transação antiga se existia
  DELETE FROM public.bank_transactions 
  WHERE reference_type = 'recurring_expense' AND reference_id = OLD.id;
  
  -- Buscar nome e categoria da despesa
  SELECT name, category INTO expense_name, expense_category
  FROM public.recurring_expenses
  WHERE id = NEW.recurring_expense_id;
  
  -- Criar nova transação se houver conta bancária
  IF NEW.bank_account_id IS NOT NULL THEN
    INSERT INTO public.bank_transactions (
      bank_account_id,
      transaction_type,
      amount,
      description,
      transaction_date,
      category,
      reference_type,
      reference_id
    ) VALUES (
      NEW.bank_account_id,
      'expense',
      NEW.payment_amount,
      'Despesa Fixa - ' || COALESCE(expense_name, 'N/A'),
      NEW.payment_date,
      COALESCE(expense_category, 'Despesas Fixas'),
      'recurring_expense',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para deletar transação quando pagamento é deletado
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_recurring_expense_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.bank_transactions 
  WHERE reference_type = 'recurring_expense' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Criar os triggers
DROP TRIGGER IF EXISTS create_bank_transaction_for_recurring_expense_payment ON recurring_expense_monthly_payments;
CREATE TRIGGER create_bank_transaction_for_recurring_expense_payment
  AFTER INSERT ON public.recurring_expense_monthly_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_recurring_expense_payment();

DROP TRIGGER IF EXISTS update_bank_transaction_for_recurring_expense_payment ON recurring_expense_monthly_payments;
CREATE TRIGGER update_bank_transaction_for_recurring_expense_payment
  AFTER UPDATE ON public.recurring_expense_monthly_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_recurring_expense_payment();

DROP TRIGGER IF EXISTS delete_bank_transaction_for_recurring_expense_payment ON recurring_expense_monthly_payments;
CREATE TRIGGER delete_bank_transaction_for_recurring_expense_payment
  AFTER DELETE ON public.recurring_expense_monthly_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_recurring_expense_payment();

-- Agora, criar as transações para pagamentos existentes que não têm transação
INSERT INTO public.bank_transactions (
  bank_account_id,
  transaction_type,
  amount,
  description,
  transaction_date,
  category,
  reference_type,
  reference_id
)
SELECT 
  remp.bank_account_id,
  'expense',
  remp.payment_amount,
  'Despesa Fixa - ' || COALESCE(re.name, 'N/A'),
  remp.payment_date,
  COALESCE(re.category, 'Despesas Fixas'),
  'recurring_expense',
  remp.id
FROM public.recurring_expense_monthly_payments remp
LEFT JOIN public.recurring_expenses re ON remp.recurring_expense_id = re.id
WHERE remp.bank_account_id IS NOT NULL
  AND remp.payment_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_transactions bt 
    WHERE bt.reference_type = 'recurring_expense' 
      AND bt.reference_id = remp.id
  );
