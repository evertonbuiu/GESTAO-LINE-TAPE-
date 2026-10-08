-- Criar trigger para deletar transação bancária quando adiantamento de colaborador for removido
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_collaborator_expense_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Delete the corresponding bank transaction
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'collaborator_advance' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Criar o trigger
DROP TRIGGER IF EXISTS delete_collaborator_expense_advance_transaction ON public.collaborator_expense_advances;

CREATE TRIGGER delete_collaborator_expense_advance_transaction
  AFTER DELETE ON public.collaborator_expense_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_bank_transaction_for_collaborator_expense_advance();