-- ============================================================
-- LINE TAPE 2026 — Colaboradores & Diaristas (ADITIVA / IDEMPOTENTE)
-- Sem DROP de coluna, sem ALTER destrutivo, sem backfill.
-- ============================================================

-- 1) FICHA BASE: colaboradores
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS social_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS secondary_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS uniform_size text,
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS default_daily_rate numeric(10,2);

-- 2) FICHA BASE: diaristas (workers)
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS social_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS primary_role text,
  ADD COLUMN IF NOT EXISTS secondary_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS uniform_size text,
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'diarista',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS default_daily_rate numeric(10,2);

-- ------------------------------------------------------------
-- VALIDAÇÕES DE DOMÍNIO (triggers, nunca CHECK — não quebram legado)
-- ------------------------------------------------------------

-- Status / vínculo de pessoas
CREATE OR REPLACE FUNCTION public.validate_person_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status text := to_jsonb(NEW) ->> 'status';
  v_type   text := to_jsonb(NEW) ->> 'employment_type';
BEGIN
  IF v_status IS NOT NULL AND v_status NOT IN ('ativo','inativo','ferias','afastado','bloqueado') THEN
    RAISE EXCEPTION 'Status inválido: %. Use ativo, inativo, ferias, afastado ou bloqueado.', v_status;
  END IF;
  IF v_type IS NOT NULL AND v_type NOT IN ('fixo','diarista','freelancer') THEN
    RAISE EXCEPTION 'Tipo de vínculo inválido: %. Use fixo, diarista ou freelancer.', v_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_worker_fields ON public.workers;
CREATE TRIGGER validate_worker_fields
  BEFORE INSERT OR UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.validate_person_fields();

DROP TRIGGER IF EXISTS validate_collaborator_fields ON public.collaborators;
CREATE TRIGGER validate_collaborator_fields
  BEFORE INSERT OR UPDATE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.validate_person_fields();

-- person_type reutilizável
CREATE OR REPLACE FUNCTION public.validate_person_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_type IS NOT NULL AND NEW.person_type NOT IN ('collaborator','worker') THEN
    RAISE EXCEPTION 'person_type inválido: %. Use collaborator ou worker.', NEW.person_type;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) DADOS SENSÍVEIS ISOLADOS (CPF, RG, bancários) — admin/financeiro apenas
CREATE TABLE IF NOT EXISTS public.person_sensitive_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type text NOT NULL,
  person_id uuid NOT NULL,
  cpf text,
  rg text,
  pix_key text,
  pix_key_type text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  account_holder_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS person_sensitive_data_unique
  ON public.person_sensitive_data (person_type, person_id);
CREATE INDEX IF NOT EXISTS person_sensitive_data_cpf_idx
  ON public.person_sensitive_data (cpf) WHERE cpf IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_sensitive_data TO authenticated;
GRANT ALL ON public.person_sensitive_data TO service_role;
ALTER TABLE public.person_sensitive_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Somente admin e financeiro acessam dados sensiveis" ON public.person_sensitive_data;
CREATE POLICY "Somente admin e financeiro acessam dados sensiveis"
  ON public.person_sensitive_data FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP TRIGGER IF EXISTS validate_person_sensitive_type ON public.person_sensitive_data;
CREATE TRIGGER validate_person_sensitive_type
  BEFORE INSERT OR UPDATE ON public.person_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION public.validate_person_type();

DROP TRIGGER IF EXISTS update_person_sensitive_data_updated_at ON public.person_sensitive_data;
CREATE TRIGGER update_person_sensitive_data_updated_at
  BEFORE UPDATE ON public.person_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUDITORIA REDIGIDA: nunca grava CPF/RG/PIX/banco/agência/conta.
-- Registra apenas ação, tipo/id da pessoa, autor, data e QUAIS campos mudaram.
CREATE OR REPLACE FUNCTION public.record_sensitive_data_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
  v_row public.person_sensitive_data := COALESCE(NEW, OLD);
  v_changed text[] := '{}';
  v_col text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_name FROM public.user_credentials WHERE id = v_actor;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY ARRAY[
      'cpf','rg','pix_key','pix_key_type','bank_name','bank_agency',
      'bank_account','bank_account_type','account_holder_name'
    ] LOOP
      IF (to_jsonb(OLD) ->> v_col) IS DISTINCT FROM (to_jsonb(NEW) ->> v_col) THEN
        v_changed := array_append(v_changed, v_col);
      END IF;
    END LOOP;

    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_name, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    v_actor,
    v_name,
    TG_OP,
    'person_sensitive_data',
    v_row.id,
    NULL,
    jsonb_build_object(
      'person_type', v_row.person_type,
      'person_id', v_row.person_id,
      'changed_fields', to_jsonb(v_changed),
      'redacted', true
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Garante que a auditoria genérica (que grava OLD/NEW completos) NÃO fique nesta tabela
DROP TRIGGER IF EXISTS trg_audit_person_sensitive_data ON public.person_sensitive_data;
DROP TRIGGER IF EXISTS trg_audit_person_sensitive_data_redacted ON public.person_sensitive_data;
CREATE TRIGGER trg_audit_person_sensitive_data_redacted
  AFTER INSERT OR UPDATE OR DELETE ON public.person_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION public.record_sensitive_data_audit();

-- 4) HISTÓRICO DE STATUS
CREATE TABLE IF NOT EXISTS public.person_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type text NOT NULL,
  person_id uuid NOT NULL,
  person_name text,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_status_history_person_idx
  ON public.person_status_history (person_type, person_id, created_at DESC);

GRANT SELECT, INSERT ON public.person_status_history TO authenticated;
GRANT ALL ON public.person_status_history TO service_role;
ALTER TABLE public.person_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem historico de status" ON public.person_status_history;
CREATE POLICY "Autenticados leem historico de status"
  ON public.person_status_history FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));

DROP POLICY IF EXISTS "Admin e financeiro registram historico de status" ON public.person_status_history;
CREATE POLICY "Admin e financeiro registram historico de status"
  ON public.person_status_history FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP TRIGGER IF EXISTS validate_person_status_history_type ON public.person_status_history;
CREATE TRIGGER validate_person_status_history_type
  BEFORE INSERT OR UPDATE ON public.person_status_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_person_type();

-- 5) DISPONIBILIDADE DE DIARISTAS
CREATE TABLE IF NOT EXISTS public.worker_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_name text,
  availability_date date NOT NULL,
  period text NOT NULL DEFAULT 'integral',
  availability text NOT NULL DEFAULT 'disponivel',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_availability_unique
  ON public.worker_availability (worker_id, availability_date, period)
  WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS worker_availability_date_idx
  ON public.worker_availability (availability_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_availability TO authenticated;
GRANT ALL ON public.worker_availability TO service_role;
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- Remove qualquer policy permissiva anterior
DROP POLICY IF EXISTS "Autenticados gerenciam disponibilidade" ON public.worker_availability;

DROP POLICY IF EXISTS "Perfis internos leem disponibilidade" ON public.worker_availability;
CREATE POLICY "Perfis internos leem disponibilidade"
  ON public.worker_availability FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));

DROP POLICY IF EXISTS "Escala cria disponibilidade" ON public.worker_availability;
CREATE POLICY "Escala cria disponibilidade"
  ON public.worker_availability FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario']));

DROP POLICY IF EXISTS "Escala atualiza disponibilidade" ON public.worker_availability;
CREATE POLICY "Escala atualiza disponibilidade"
  ON public.worker_availability FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario']));

DROP POLICY IF EXISTS "Escala remove disponibilidade" ON public.worker_availability;
CREATE POLICY "Escala remove disponibilidade"
  ON public.worker_availability FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario']));

CREATE OR REPLACE FUNCTION public.validate_worker_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.period IS NOT NULL AND NEW.period NOT IN ('integral','manha','tarde','noite') THEN
    RAISE EXCEPTION 'Período inválido: %. Use integral, manha, tarde ou noite.', NEW.period;
  END IF;
  IF NEW.availability IS NOT NULL AND NEW.availability NOT IN ('disponivel','indisponivel','parcial') THEN
    RAISE EXCEPTION 'Disponibilidade inválida: %. Use disponivel, indisponivel ou parcial.', NEW.availability;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_worker_availability_trg ON public.worker_availability;
CREATE TRIGGER validate_worker_availability_trg
  BEFORE INSERT OR UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.validate_worker_availability();

DROP TRIGGER IF EXISTS update_worker_availability_updated_at ON public.worker_availability;
CREATE TRIGGER update_worker_availability_updated_at
  BEFORE UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) VÍNCULO ESTÁVEL POR ID NA ESCALA (nullable, sem backfill)
ALTER TABLE public.daily_rates
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL;

ALTER TABLE public.event_collaborators
  ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS person_type text;

DROP TRIGGER IF EXISTS validate_event_collaborators_person_type ON public.event_collaborators;
CREATE TRIGGER validate_event_collaborators_person_type
  BEFORE INSERT OR UPDATE ON public.event_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.validate_person_type();

CREATE INDEX IF NOT EXISTS daily_rates_worker_id_idx ON public.daily_rates (worker_id);
CREATE INDEX IF NOT EXISTS event_collaborators_collab_id_idx ON public.event_collaborators (collaborator_id);
CREATE INDEX IF NOT EXISTS event_collaborators_worker_id_idx ON public.event_collaborators (worker_id);

-- 7) DIÁRIA: campos operacionais e financeiros
ALTER TABLE public.daily_rates
  ADD COLUMN IF NOT EXISTS event_role text,
  ADD COLUMN IF NOT EXISTS planned_start_time time,
  ADD COLUMN IF NOT EXISTS planned_end_time time,
  ADD COLUMN IF NOT EXISTS actual_start_time time,
  ADD COLUMN IF NOT EXISTS actual_end_time time,
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'prevista',
  ADD COLUMN IF NOT EXISTS substituted_worker_name text,
  ADD COLUMN IF NOT EXISTS overtime_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lodging_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- Domínios + valores monetários não negativos (exceto desconto/adiantamento)
CREATE OR REPLACE FUNCTION public.validate_daily_rate_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.attendance_status IS NOT NULL
     AND NEW.attendance_status NOT IN ('prevista','presente','falta','substituido','cancelada') THEN
    RAISE EXCEPTION 'Presença inválida: %. Use prevista, presente, falta, substituido ou cancelada.', NEW.attendance_status;
  END IF;

  IF NEW.payment_status IS NOT NULL
     AND NEW.payment_status NOT IN ('pendente','aprovado','pago','cancelado') THEN
    RAISE EXCEPTION 'Status de pagamento inválido: %. Use pendente, aprovado, pago ou cancelado.', NEW.payment_status;
  END IF;

  -- Adicionais nunca negativos. discount_amount fica livre (regra existente de desconto/adiantamento).
  IF COALESCE(NEW.overtime_amount, 0)  < 0 THEN RAISE EXCEPTION 'Hora extra não pode ser negativa.'; END IF;
  IF COALESCE(NEW.food_amount, 0)      < 0 THEN RAISE EXCEPTION 'Alimentação não pode ser negativa.'; END IF;
  IF COALESCE(NEW.transport_amount, 0) < 0 THEN RAISE EXCEPTION 'Transporte não pode ser negativo.'; END IF;
  IF COALESCE(NEW.lodging_amount, 0)   < 0 THEN RAISE EXCEPTION 'Hospedagem não pode ser negativa.'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_daily_rate_fields_trg ON public.daily_rates;
CREATE TRIGGER validate_daily_rate_fields_trg
  BEFORE INSERT OR UPDATE ON public.daily_rates
  FOR EACH ROW EXECUTE FUNCTION public.validate_daily_rate_fields();

CREATE INDEX IF NOT EXISTS daily_rates_payment_status_idx ON public.daily_rates (payment_status);
CREATE INDEX IF NOT EXISTS daily_rates_date_idx ON public.daily_rates (date);

-- 8) APOIO À DETECÇÃO DE DUPLICIDADE (sem merge automático)
CREATE INDEX IF NOT EXISTS workers_phone_idx ON public.workers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS collaborators_phone_idx ON public.collaborators (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS workers_name_lower_idx ON public.workers (lower(name));
CREATE INDEX IF NOT EXISTS collaborators_name_lower_idx ON public.collaborators (lower(name));