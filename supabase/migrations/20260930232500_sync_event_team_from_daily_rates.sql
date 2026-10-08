-- Mantém a equipe do evento sincronizada com os diaristas vinculados em diárias.
-- Abrange criação, edição/troca de evento e exclusão sem duplicar a mesma pessoa.

CREATE OR REPLACE FUNCTION public.reconcile_daily_rate_event_team(
  p_event_id uuid,
  p_worker_id uuid,
  p_worker_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate public.daily_rates%ROWTYPE;
  v_email text := '';
BEGIN
  IF p_event_id IS NULL OR NULLIF(BTRIM(p_worker_name), '') IS NULL THEN
    RETURN;
  END IF;

  -- Recria somente os vínculos automáticos; vínculos manuais são preservados.
  DELETE FROM public.event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.reference_type = 'daily_rate'
    AND (
      (p_worker_id IS NOT NULL AND ec.worker_id = p_worker_id)
      OR LOWER(BTRIM(ec.collaborator_name)) = LOWER(BTRIM(p_worker_name))
    );

  SELECT dr.*
    INTO v_rate
  FROM public.daily_rates dr
  WHERE dr.event_id = p_event_id
    AND (
      (p_worker_id IS NOT NULL AND dr.worker_id = p_worker_id)
      OR LOWER(BTRIM(dr.worker_name)) = LOWER(BTRIM(p_worker_name))
    )
  ORDER BY dr.date, dr.created_at, dr.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se a pessoa já foi incluída manualmente, não cria uma segunda linha.
  IF EXISTS (
    SELECT 1
    FROM public.event_collaborators ec
    WHERE ec.event_id = p_event_id
      AND ec.reference_type IS DISTINCT FROM 'daily_rate'
      AND (
        (COALESCE(v_rate.worker_id, p_worker_id) IS NOT NULL AND ec.worker_id = COALESCE(v_rate.worker_id, p_worker_id))
        OR LOWER(BTRIM(ec.collaborator_name)) = LOWER(BTRIM(v_rate.worker_name))
      )
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(w.email, '')
    INTO v_email
  FROM public.workers w
  WHERE w.id = COALESCE(v_rate.worker_id, p_worker_id)
  LIMIT 1;

  INSERT INTO public.event_collaborators (
    event_id,
    collaborator_name,
    collaborator_email,
    role,
    reference_type,
    reference_id,
    assigned_by,
    worker_id,
    collaborator_id,
    person_type
  ) VALUES (
    p_event_id,
    v_rate.worker_name,
    COALESCE(v_email, ''),
    COALESCE(NULLIF(BTRIM(v_rate.event_role), ''), 'diarista'),
    'daily_rate',
    v_rate.id,
    v_rate.created_by,
    COALESCE(v_rate.worker_id, p_worker_id),
    NULL,
    'worker'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_team_from_daily_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.event_id IS NOT NULL THEN
    PERFORM public.reconcile_daily_rate_event_team(OLD.event_id, OLD.worker_id, OLD.worker_name);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.event_id IS NOT NULL THEN
    PERFORM public.reconcile_daily_rate_event_team(NEW.event_id, NEW.worker_id, NEW.worker_name);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_event_collaborator_from_daily_rate_trigger ON public.daily_rates;
DROP TRIGGER IF EXISTS update_event_collaborator_from_daily_rate_trigger ON public.daily_rates;
DROP TRIGGER IF EXISTS delete_event_collaborator_from_daily_rate_trigger ON public.daily_rates;
DROP TRIGGER IF EXISTS sync_event_team_from_daily_rate_trigger ON public.daily_rates;

CREATE TRIGGER sync_event_team_from_daily_rate_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_rates
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_team_from_daily_rate();

-- Corrige os vínculos que já existem antes desta migração.
DO $$
DECLARE
  v_link record;
BEGIN
  FOR v_link IN
    SELECT DISTINCT dr.event_id, dr.worker_id, dr.worker_name
    FROM public.daily_rates dr
    WHERE dr.event_id IS NOT NULL
      AND NULLIF(BTRIM(dr.worker_name), '') IS NOT NULL
  LOOP
    PERFORM public.reconcile_daily_rate_event_team(v_link.event_id, v_link.worker_id, v_link.worker_name);
  END LOOP;
END;
$$;
