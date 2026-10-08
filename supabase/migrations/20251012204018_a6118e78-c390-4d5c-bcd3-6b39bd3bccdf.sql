-- Atualizar triggers para usar "Adiantamento" ao invés de "Vale"

-- Atualizar função que cria transação bancária para adiantamento de colaborador
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_collaborator_advance()
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
  
  -- Insert bank transaction for the advance
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
    'Adiantamento - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    NEW.amount,
    'expense',
    'Adiantamentos de Colaboradores',
    'collaborator_advance',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$function$;

-- Atualizar função que atualiza transação bancária para adiantamento de colaborador
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_collaborator_advance()
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
    description = 'Adiantamento - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'collaborator_advance' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função que cria transação bancária para adiantamento de diarista (worker)
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert bank transaction for the advance
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
    'Adiantamento - ' || NEW.worker_name,
    NEW.amount,
    'expense',
    'Adiantamentos de Diaristas',
    'worker_advance',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$function$;

-- Atualizar função que atualiza transação bancária para adiantamento de diarista (worker)
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_advance()
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
    description = 'Adiantamento - ' || NEW.worker_name,
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'worker_advance' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$function$;