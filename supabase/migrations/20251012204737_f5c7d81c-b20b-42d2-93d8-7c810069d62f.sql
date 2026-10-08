-- Criar triggers para vales (separados de adiantamentos)
-- Usar "Vale" na descrição e categorias específicas

-- Função para criar transação bancária ao criar vale de colaborador
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_collaborator_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  collaborator_name_value TEXT;
BEGIN
  -- Get collaborator name
  SELECT name INTO collaborator_name_value
  FROM public.collaborators
  WHERE id = NEW.collaborator_id;
  
  -- Insert bank transaction for the vale
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
    'Vale - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    NEW.amount,
    'expense',
    'Vales de Colaboradores',
    'collaborator_vale',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$function$;

-- Função para atualizar transação bancária ao atualizar vale de colaborador
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_collaborator_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  collaborator_name_value TEXT;
BEGIN
  -- Get collaborator name
  SELECT name INTO collaborator_name_value
  FROM public.collaborators
  WHERE id = NEW.collaborator_id;
  
  -- Update the corresponding bank transaction
  UPDATE public.bank_transactions
  SET 
    bank_account_id = NEW.bank_account_id,
    description = 'Vale - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'collaborator_vale' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Função para deletar transação bancária ao deletar vale de colaborador
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_collaborator_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete the corresponding bank transaction
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'collaborator_vale' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Função para criar transação bancária ao criar vale de diarista
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_worker_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert bank transaction for the vale
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
    'Vale - ' || NEW.worker_name,
    NEW.amount,
    'expense',
    'Vales de Diaristas',
    'worker_vale',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$function$;

-- Função para atualizar transação bancária ao atualizar vale de diarista
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_worker_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the corresponding bank transaction
  UPDATE public.bank_transactions
  SET 
    bank_account_id = NEW.bank_account_id,
    description = 'Vale - ' || NEW.worker_name,
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'worker_vale' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Função para deletar transação bancária ao deletar vale de diarista
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_worker_vale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete the corresponding bank transaction
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'worker_vale' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS create_collaborator_advance_transaction ON public.collaborator_advances;
DROP TRIGGER IF EXISTS update_collaborator_advance_transaction ON public.collaborator_advances;
DROP TRIGGER IF EXISTS delete_collaborator_advance_transaction ON public.collaborator_advances;
DROP TRIGGER IF EXISTS trigger_create_bank_transaction_for_advance ON public.worker_advances;
DROP TRIGGER IF EXISTS trigger_update_bank_transaction_for_advance ON public.worker_advances;
DROP TRIGGER IF EXISTS trigger_delete_bank_transaction_for_advance ON public.worker_advances;

-- Criar novos triggers para vales de colaboradores
CREATE TRIGGER create_collaborator_vale_transaction
  AFTER INSERT ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_collaborator_vale();

CREATE TRIGGER update_collaborator_vale_transaction
  AFTER UPDATE ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_collaborator_vale();

CREATE TRIGGER delete_collaborator_vale_transaction
  AFTER DELETE ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_collaborator_vale();

-- Criar novos triggers para vales de diaristas
CREATE TRIGGER create_worker_vale_transaction
  AFTER INSERT ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_worker_vale();

CREATE TRIGGER update_worker_vale_transaction
  AFTER UPDATE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_worker_vale();

CREATE TRIGGER delete_worker_vale_transaction
  AFTER DELETE ON public.worker_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_worker_vale();