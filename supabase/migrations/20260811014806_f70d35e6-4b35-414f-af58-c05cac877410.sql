CREATE TABLE IF NOT EXISTS public.bank_transaction_reconciliations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL
    REFERENCES public.bank_transactions(id) ON DELETE RESTRICT,
  reconciled_by       uuid,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transaction_reconciliations_unique UNIQUE (bank_transaction_id)
);

CREATE TABLE IF NOT EXISTS public.bank_account_closings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL
    REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  closed_through  date NOT NULL,
  closing_balance numeric(14,2) NOT NULL DEFAULT 0,
  closed_by       uuid,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_account_closings_unique UNIQUE (bank_account_id, closed_through)
);

CREATE INDEX IF NOT EXISTS idx_btr_tx      ON public.bank_transaction_reconciliations(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bac_account ON public.bank_account_closings(bank_account_id, closed_through DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transaction_reconciliations TO authenticated;
GRANT ALL  ON public.bank_transaction_reconciliations TO service_role;

GRANT SELECT, INSERT ON public.bank_account_closings TO authenticated;
GRANT SELECT, INSERT ON public.bank_account_closings TO service_role;

ALTER TABLE public.bank_transaction_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_closings            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btr_select ON public.bank_transaction_reconciliations;
DROP POLICY IF EXISTS btr_insert ON public.bank_transaction_reconciliations;
DROP POLICY IF EXISTS btr_update ON public.bank_transaction_reconciliations;
DROP POLICY IF EXISTS btr_delete ON public.bank_transaction_reconciliations;

CREATE POLICY btr_select ON public.bank_transaction_reconciliations
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY btr_insert ON public.bank_transaction_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY btr_update ON public.bank_transaction_reconciliations
  FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY btr_delete ON public.bank_transaction_reconciliations
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP POLICY IF EXISTS bac_select ON public.bank_account_closings;
DROP POLICY IF EXISTS bac_insert ON public.bank_account_closings;
DROP POLICY IF EXISTS bac_all    ON public.bank_account_closings;

CREATE POLICY bac_select ON public.bank_account_closings
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY bac_insert ON public.bank_account_closings
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

CREATE OR REPLACE FUNCTION public.force_reconciliation_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.reconciled_by := auth.uid();
  NEW.updated_at    := now();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_force_reconciliation_actor ON public.bank_transaction_reconciliations;
CREATE TRIGGER trg_force_reconciliation_actor
  BEFORE INSERT OR UPDATE ON public.bank_transaction_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.force_reconciliation_actor();

CREATE OR REPLACE FUNCTION public.force_closing_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.closed_by  := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_force_closing_actor ON public.bank_account_closings;
CREATE TRIGGER trg_force_closing_actor
  BEFORE INSERT ON public.bank_account_closings
  FOR EACH ROW EXECUTE FUNCTION public.force_closing_actor();

CREATE OR REPLACE FUNCTION public.enforce_closing_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.maintenance_mode', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Fechamento de período é imutável (% bloqueado).', TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_closing_immutable ON public.bank_account_closings;
CREATE TRIGGER trg_closing_immutable
  BEFORE UPDATE OR DELETE ON public.bank_account_closings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closing_immutability();

CREATE OR REPLACE FUNCTION public.record_ledger_extra_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name  text;
  v_id    uuid := COALESCE((to_jsonb(NEW) ->> 'id')::uuid, (to_jsonb(OLD) ->> 'id')::uuid);
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_name FROM public.user_credentials WHERE id = v_actor;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_actor, v_name, TG_OP, TG_TABLE_NAME, v_id, NULL,
          jsonb_build_object('redacted', true));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_btr ON public.bank_transaction_reconciliations;
CREATE TRIGGER trg_audit_btr
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_transaction_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.record_ledger_extra_audit();

DROP TRIGGER IF EXISTS trg_audit_bac ON public.bank_account_closings;
CREATE TRIGGER trg_audit_bac
  AFTER INSERT ON public.bank_account_closings
  FOR EACH ROW EXECUTE FUNCTION public.record_ledger_extra_audit();

CREATE OR REPLACE FUNCTION public.is_bank_period_closed(_account_id uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bank_account_closings c
    WHERE c.bank_account_id = _account_id
      AND _date <= c.closed_through
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_bank_period_closing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.maintenance_mode', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP IN ('UPDATE','DELETE')
     AND public.is_bank_period_closed(OLD.bank_account_id, OLD.transaction_date) THEN
    RAISE EXCEPTION 'Período já fechado para esta conta até a data do lançamento original.';
  END IF;

  IF TG_OP IN ('INSERT','UPDATE')
     AND public.is_bank_period_closed(NEW.bank_account_id, NEW.transaction_date) THEN
    RAISE EXCEPTION 'Período já fechado para esta conta na data informada.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_bank_period_closing ON public.bank_transactions;
CREATE TRIGGER trg_enforce_bank_period_closing
  BEFORE INSERT OR UPDATE OR DELETE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bank_period_closing();