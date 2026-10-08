-- Função para criar despesa de evento quando diária é criada
CREATE OR REPLACE FUNCTION public.create_event_expense_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    INSERT INTO public.event_expenses (
      event_id,
      category,
      description,
      quantity,
      unit_price,
      total_price,
      expense_date,
      reference_type,
      reference_id,
      created_by
    ) VALUES (
      NEW.event_id,
      'Diárias',
      'Diária - ' || NEW.worker_name,
      1,
      NEW.amount,
      NEW.amount,
      NEW.date,
      'daily_rate',
      NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Função para atualizar despesa quando diária é atualizada
CREATE OR REPLACE FUNCTION public.update_event_expense_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.event_expenses
  SET 
    event_id = NEW.event_id,
    description = 'Diária - ' || NEW.worker_name,
    unit_price = NEW.amount,
    total_price = NEW.amount,
    expense_date = NEW.date,
    updated_at = now()
  WHERE reference_type = 'daily_rate' 
    AND reference_id = NEW.id;
  
  IF NOT FOUND AND NEW.event_id IS NOT NULL THEN
    INSERT INTO public.event_expenses (
      event_id,
      category,
      description,
      quantity,
      unit_price,
      total_price,
      expense_date,
      reference_type,
      reference_id,
      created_by
    ) VALUES (
      NEW.event_id,
      'Diárias',
      'Diária - ' || NEW.worker_name,
      1,
      NEW.amount,
      NEW.amount,
      NEW.date,
      'daily_rate',
      NEW.id,
      NEW.created_by
    );
  END IF;
  
  IF OLD.event_id IS NOT NULL AND NEW.event_id IS NULL THEN
    DELETE FROM public.event_expenses
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para deletar despesa quando diária é deletada
CREATE OR REPLACE FUNCTION public.delete_event_expense_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.event_expenses
  WHERE reference_type = 'daily_rate' 
    AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;