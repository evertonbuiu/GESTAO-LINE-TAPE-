-- ============ 1) contracts: colunas aditivas ============
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS sections_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS details jsonb,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS source_quote_number text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- ============ 2) contract_templates ============
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_name_version_key
  ON public.contract_templates (name, version);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comercial read" ON public.contract_templates;
CREATE POLICY "Comercial read" ON public.contract_templates
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));

DROP POLICY IF EXISTS "Comercial write" ON public.contract_templates;
CREATE POLICY "Comercial write" ON public.contract_templates
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3) contract_history ============
CREATE TABLE IF NOT EXISTS public.contract_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_name text,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_history_contract_id_idx
  ON public.contract_history (contract_id, created_at DESC);

GRANT SELECT, INSERT ON public.contract_history TO authenticated;
GRANT ALL ON public.contract_history TO service_role;

ALTER TABLE public.contract_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comercial read" ON public.contract_history;
CREATE POLICY "Comercial read" ON public.contract_history
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));

DROP POLICY IF EXISTS "Comercial insert" ON public.contract_history;
CREATE POLICY "Comercial insert" ON public.contract_history
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

-- ============ 4) Trava permanente após assinatura ============
CREATE OR REPLACE FUNCTION public.enforce_signed_contract_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  was_locked boolean := COALESCE(OLD.locked, false) OR OLD.status = 'assinado';
BEGIN
  -- (a) Transição para 'assinado': trava permanente + carimbo de assinatura.
  IF NEW.status = 'assinado' AND OLD.status IS DISTINCT FROM 'assinado' THEN
    NEW.locked := true;
    IF NEW.signed_at IS NULL THEN
      NEW.signed_at := now();
    END IF;
  END IF;

  -- (b) Já travado (ou já assinado): conteúdo imutável e trava irreversível.
  IF was_locked THEN
    NEW.locked := true;  -- destravar é proibido; normaliza silenciosamente
    IF COALESCE(NEW.locked, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Contrato assinado não pode ser destravado.';
    END IF;

    IF NEW.client_name IS DISTINCT FROM OLD.client_name
      OR NEW.client_document IS DISTINCT FROM OLD.client_document
      OR NEW.client_email IS DISTINCT FROM OLD.client_email
      OR NEW.client_phone IS DISTINCT FROM OLD.client_phone
      OR NEW.service_description IS DISTINCT FROM OLD.service_description
      OR NEW.start_date IS DISTINCT FROM OLD.start_date
      OR NEW.end_date IS DISTINCT FROM OLD.end_date
      OR NEW.total_value IS DISTINCT FROM OLD.total_value
      OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
      OR NEW.sections_snapshot IS DISTINCT FROM OLD.sections_snapshot
      OR NEW.details IS DISTINCT FROM OLD.details
      OR NEW.template_id IS DISTINCT FROM OLD.template_id
      OR NEW.template_version IS DISTINCT FROM OLD.template_version
      OR NEW.template_name IS DISTINCT FROM OLD.template_name
      OR NEW.contract_number IS DISTINCT FROM OLD.contract_number
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.event_id IS DISTINCT FROM OLD.event_id
      OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
      OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    THEN
      RAISE EXCEPTION 'Contrato assinado não pode ter seu conteúdo alterado. Somente status, anexos e metadados autorizados.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signed_contract_immutability ON public.contracts;
CREATE TRIGGER enforce_signed_contract_immutability
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signed_contract_immutability();

-- Contratos legados NÃO são travados retroativamente: nenhum UPDATE de backfill.

-- ============ 5) Histórico automático ============
CREATE OR REPLACE FUNCTION public.record_contract_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_name FROM public.user_credentials WHERE id = v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contract_history (contract_id, action, from_status, to_status, actor_id, actor_name)
    VALUES (NEW.id, 'created', NULL, NEW.status, v_actor, v_name);
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(OLD) = to_jsonb(NEW) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.contract_history (contract_id, action, from_status, to_status, actor_id, actor_name, changes)
    VALUES (
      NEW.id,
      CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed' ELSE 'updated' END,
      OLD.status, NEW.status, v_actor, v_name,
      jsonb_build_object('total_value', NEW.total_value, 'template_version', NEW.template_version, 'locked', NEW.locked)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_contract_history ON public.contracts;
CREATE TRIGGER record_contract_history
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.record_contract_history();

-- ============ 6) Modelo padrão versionado (idempotente) ============
INSERT INTO public.contract_templates (name, version, description, sections, is_active)
SELECT
  'Contrato de Locação e Serviços — LINE TAPE',
  1,
  'Modelo padrão v1 com as cláusulas atualmente utilizadas pela empresa.',
  '[]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_templates
  WHERE name = 'Contrato de Locação e Serviços — LINE TAPE' AND version = 1
);