-- Função para criar transação bancária quando vale de diarista é inserido
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_worker_advance()
RETURNS TRIGGER AS $$
BEGIN
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
      NEW.amount,
      'Vale Diarista: ' || NEW.worker_name,
      NEW.advance_date,
      'Vale Diarista',
      'worker_advance',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para atualizar transação bancária quando vale é atualizado
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_worker_advance()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar transação antiga se existia conta bancária
  IF OLD.bank_account_id IS NOT NULL THEN
    DELETE FROM public.bank_transactions 
    WHERE reference_type = 'worker_advance' AND reference_id = OLD.id;
  END IF;
  
  -- Criar nova transação se há conta bancária
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
      NEW.amount,
      'Vale Diarista: ' || NEW.worker_name,
      NEW.advance_date,
      'Vale Diarista',
      'worker_advance',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para deletar transação bancária quando vale é deletado
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_worker_advance()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.bank_transactions 
  WHERE reference_type = 'worker_advance' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers na tabela worker_advances
CREATE TRIGGER create_worker_advance_transaction
  AFTER INSERT ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_worker_advance();

CREATE TRIGGER update_worker_advance_transaction
  AFTER UPDATE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_worker_advance();

CREATE TRIGGER delete_worker_advance_transaction
  AFTER DELETE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_worker_advance();