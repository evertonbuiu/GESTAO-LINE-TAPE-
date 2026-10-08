-- Create function to create bank transaction for collaborator advance
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_collaborator_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'Vale - ' || COALESCE(collaborator_name_value, 'Colaborador'),
    NEW.amount,
    'expense',
    'Vales de Colaboradores',
    'collaborator_advance',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$$;

-- Create function to update bank transaction for collaborator advance
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_collaborator_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE reference_type = 'collaborator_advance' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create function to delete bank transaction for collaborator advance
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_collaborator_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the corresponding bank transaction
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'collaborator_advance' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Create trigger for INSERT
CREATE TRIGGER create_collaborator_advance_transaction
  AFTER INSERT ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bank_transaction_for_collaborator_advance();

-- Create trigger for UPDATE
CREATE TRIGGER update_collaborator_advance_transaction
  AFTER UPDATE ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_transaction_for_collaborator_advance();

-- Create trigger for DELETE
CREATE TRIGGER delete_collaborator_advance_transaction
  BEFORE DELETE ON public.collaborator_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_collaborator_advance();