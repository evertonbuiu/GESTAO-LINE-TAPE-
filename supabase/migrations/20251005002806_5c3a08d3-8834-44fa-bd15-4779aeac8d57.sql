-- Create worker_advances table to track advances (vales) given to daily workers
CREATE TABLE public.worker_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_advances ENABLE ROW LEVEL SECURITY;

-- Create policy for access
CREATE POLICY "Allow all access to worker advances" 
ON public.worker_advances 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger to automatically create bank transaction when advance is created
CREATE OR REPLACE FUNCTION public.create_bank_transaction_for_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'Vale - ' || NEW.worker_name,
    NEW.amount,
    'expense',
    'Vales de Diaristas',
    'worker_advance',
    NEW.id,
    NEW.advance_date
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_bank_transaction_for_advance
AFTER INSERT ON public.worker_advances
FOR EACH ROW
EXECUTE FUNCTION public.create_bank_transaction_for_advance();

-- Create trigger to update bank transaction when advance is updated
CREATE OR REPLACE FUNCTION public.update_bank_transaction_for_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the corresponding bank transaction
  UPDATE public.bank_transactions
  SET 
    bank_account_id = NEW.bank_account_id,
    description = 'Vale - ' || NEW.worker_name,
    amount = NEW.amount,
    transaction_date = NEW.advance_date,
    updated_at = now()
  WHERE reference_type = 'worker_advance' 
    AND reference_id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_bank_transaction_for_advance
AFTER UPDATE ON public.worker_advances
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_transaction_for_advance();

-- Create trigger to delete bank transaction when advance is deleted
CREATE OR REPLACE FUNCTION public.delete_bank_transaction_for_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the corresponding bank transaction
  DELETE FROM public.bank_transactions
  WHERE reference_type = 'worker_advance' 
    AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_delete_bank_transaction_for_advance
AFTER DELETE ON public.worker_advances
FOR EACH ROW
EXECUTE FUNCTION public.delete_bank_transaction_for_advance();