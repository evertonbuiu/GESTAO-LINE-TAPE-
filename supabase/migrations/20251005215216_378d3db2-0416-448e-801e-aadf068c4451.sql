-- Adicionar campos de referência na tabela event_collaborators
ALTER TABLE public.event_collaborators 
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_event_collaborators_reference 
ON public.event_collaborators(reference_type, reference_id);

-- Função para criar colaborador de evento quando diária é criada
CREATE OR REPLACE FUNCTION public.create_event_collaborator_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.event_id IS NOT NULL THEN
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
  RETURN NEW;
END;
$$;

-- Função para atualizar colaborador quando diária é atualizada
CREATE OR REPLACE FUNCTION public.update_event_collaborator_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.event_collaborators
  SET 
    event_id = NEW.event_id,
    collaborator_name = NEW.worker_name,
    updated_at = now()
  WHERE reference_type = 'daily_rate' 
    AND reference_id = NEW.id;
  
  IF NOT FOUND AND NEW.event_id IS NOT NULL THEN
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
  
  IF OLD.event_id IS NOT NULL AND NEW.event_id IS NULL THEN
    DELETE FROM public.event_collaborators
    WHERE reference_type = 'daily_rate' 
      AND reference_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para deletar colaborador quando diária é deletada
CREATE OR REPLACE FUNCTION public.delete_event_collaborator_from_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.event_collaborators
  WHERE reference_type = 'daily_rate' 
    AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;