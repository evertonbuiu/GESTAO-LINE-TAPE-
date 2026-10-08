-- Função para criar transação bancária quando um adiantamento de despesa de diarista é criado
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_worker_expense_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir transação bancária para o adiantamento de despesa
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
    NEW.bank_account_id,
    'Adiantamento de Despesa - ' || NEW.worker_name,
    NEW.amount,
    'expense',
    'Adiantamentos de Despesas de Diaristas',
    'worker_expense_advance',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$$;

-- Função para atualizar transação bancária quando um adiantamento de despesa de diarista é atualizado
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_worker_expense_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar a transação bancária correspondente
  UPDATE public.bank_transactions
  SET 
    bank_account_id = NEW.bank_account_id,
    description = 'Adiantamento de Despesa - ' || NEW.worker_name,
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'worker_expense_advance' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Função para deletar transação bancária quando um adiantamento de despesa de diarista é deletado
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_worker_expense_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deletar a transação bancária correspondente
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'worker_expense_advance' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Criar triggers para worker_expense_advances
DROP TRIGGER IF EXISTS create_transaction_for_worker_expense_advance ON public.worker_expense_advances;
CREATE TRIGGER create_transaction_for_worker_expense_advance
  AFTER INSERT ON public.worker_expense_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_worker_expense_advance();

DROP TRIGGER IF EXISTS update_transaction_for_worker_expense_advance ON public.worker_expense_advances;
CREATE TRIGGER update_transaction_for_worker_expense_advance
  AFTER UPDATE ON public.worker_expense_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_worker_expense_advance();

DROP TRIGGER IF EXISTS delete_transaction_for_worker_expense_advance ON public.worker_expense_advances;
CREATE TRIGGER delete_transaction_for_worker_expense_advance
  BEFORE DELETE ON public.worker_expense_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_worker_expense_advance();

-- Verificar e recriar triggers para worker_advances (já devem existir, mas garantindo)
DROP TRIGGER IF EXISTS create_transaction_for_advance ON public.worker_advances;
CREATE TRIGGER create_transaction_for_advance
  AFTER INSERT ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_advance();

DROP TRIGGER IF EXISTS update_transaction_for_advance ON public.worker_advances;
CREATE TRIGGER update_transaction_for_advance
  AFTER UPDATE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_advance();

DROP TRIGGER IF EXISTS delete_transaction_for_advance ON public.worker_advances;
CREATE TRIGGER delete_transaction_for_advance
  BEFORE DELETE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_advance();