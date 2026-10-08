-- Atualizar função para evitar duplicação de colaboradores
CREATE OR REPLACE FUNCTION public.create_event_collaborator_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    -- Verificar se já existe colaborador com este reference_id
    SELECT COUNT(*) INTO existing_count
    FROM public.event_collaborators
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
    
    -- Só inserir se não existir
    IF existing_count = 0 THEN
      INSERT INTO public.event_collaborators (
        event_id,
        collaborator_name,
        collaborator_email,
        role,
        reference_type,
        reference_id,
        assigned_by
      ) VALUES (
        NEW.event_id,
        NEW.worker_name,
        '',
        'diarista',
        'daily_rate',
        NEW.id,
        NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;