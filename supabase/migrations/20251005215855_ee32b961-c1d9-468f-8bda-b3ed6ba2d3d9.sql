-- Atualizar função para evitar duplicação de despesas
CREATE OR REPLACE FUNCTION public.create_event_expense_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Só criar despesa se a diária estiver vinculada a um evento
  IF NEW.event_id IS NOT NULL THEN
    -- Verificar se já existe despesa com este reference_id
    SELECT COUNT(*) INTO existing_count
    FROM public.event_expenses
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
    
    -- Só inserir se não existir
    IF existing_count = 0 THEN
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
  END IF;
  RETURN NEW;
END;
$$;