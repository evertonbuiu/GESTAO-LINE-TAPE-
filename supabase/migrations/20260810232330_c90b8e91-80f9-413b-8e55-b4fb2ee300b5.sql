-- ===========================================================
-- LINE TAPE 2026 · Módulo Financeiro (aditivo e idempotente)
-- ===========================================================

-- 1) TABELAS ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_titles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('receber','pagar')),
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('rascunho','pendente','aprovado','pago','cancelado','estornado')),
  description   text NOT NULL,
  total_amount  numeric(14,2) NOT NULL CHECK (total_amount > 0),
  client_id     uuid,
  event_id      uuid,
  contract_id   uuid,
  quote_id      uuid,
  supplier_name text,
  category      text,
  cost_center   text,
  source_type   text,
  source_id     uuid,
  issue_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  due_date      date NOT NULL,
  notes         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_installments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id    uuid NOT NULL REFERENCES public.finance_titles(id),
  number      integer NOT NULL CHECK (number > 0),
  due_date    date NOT NULL,
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  status      text NOT NULL DEFAULT 'pendente'
              CHECK (status IN ('pendente','parcial','pago','cancelado')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, number)
);

CREATE TABLE IF NOT EXISTS public.finance_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id            uuid NOT NULL REFERENCES public.finance_titles(id),
  installment_id      uuid REFERENCES public.finance_installments(id),
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at             date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  method              text,
  bank_account_id     uuid,
  receipt_url         text,
  discount_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  interest_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
  fine_amount         numeric(14,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
  is_reversal         boolean NOT NULL DEFAULT false,
  reverses_payment_id uuid REFERENCES public.finance_payments(id),
  notes               text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_titles_source_uidx
  ON public.finance_titles (source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS finance_payments_reversal_uidx
  ON public.finance_payments (reverses_payment_id)
  WHERE reverses_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_titles_due_idx ON public.finance_titles (kind, status, due_date);
CREATE INDEX IF NOT EXISTS finance_titles_event_idx ON public.finance_titles (event_id);
CREATE INDEX IF NOT EXISTS finance_installments_title_idx ON public.finance_installments (title_id);
CREATE INDEX IF NOT EXISTS finance_payments_title_idx ON public.finance_payments (title_id);

-- 2) GRANTS -------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.finance_titles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_installments TO authenticated;
GRANT SELECT, INSERT ON public.finance_payments TO authenticated;
GRANT ALL ON public.finance_titles TO service_role;
GRANT ALL ON public.finance_installments TO service_role;
GRANT ALL ON public.finance_payments TO service_role;

-- 3) RLS ----------------------------------------------------
ALTER TABLE public.finance_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_titles_read_finance ON public.finance_titles;
DROP POLICY IF EXISTS finance_titles_insert_finance ON public.finance_titles;
DROP POLICY IF EXISTS finance_titles_update_finance ON public.finance_titles;
DROP POLICY IF EXISTS finance_installments_read_finance ON public.finance_installments;
DROP POLICY IF EXISTS finance_installments_insert_finance ON public.finance_installments;
DROP POLICY IF EXISTS finance_installments_update_finance ON public.finance_installments;
DROP POLICY IF EXISTS finance_payments_read_finance ON public.finance_payments;
DROP POLICY IF EXISTS finance_payments_insert_finance ON public.finance_payments;
DROP POLICY IF EXISTS finance_payments_update_finance ON public.finance_payments;

CREATE POLICY finance_titles_read_finance ON public.finance_titles
  FOR SELECT TO authenticated USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY finance_titles_insert_finance ON public.finance_titles
  FOR INSERT TO authenticated WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY finance_titles_update_finance ON public.finance_titles
  FOR UPDATE TO authenticated USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

CREATE POLICY finance_installments_read_finance ON public.finance_installments
  FOR SELECT TO authenticated USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY finance_installments_insert_finance ON public.finance_installments
  FOR INSERT TO authenticated WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY finance_installments_update_finance ON public.finance_installments
  FOR UPDATE TO authenticated USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

CREATE POLICY finance_payments_read_finance ON public.finance_payments
  FOR SELECT TO authenticated USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY finance_payments_insert_finance ON public.finance_payments
  FOR INSERT TO authenticated WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

-- 4) SEM DELETE ---------------------------------------------
CREATE OR REPLACE FUNCTION public.forbid_finance_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Exclusão não permitida em %. Use cancelamento ou estorno.', TG_TABLE_NAME;
END; $$;

DROP TRIGGER IF EXISTS trg_forbid_delete_finance_titles ON public.finance_titles;
DROP TRIGGER IF EXISTS trg_forbid_delete_finance_installments ON public.finance_installments;
DROP TRIGGER IF EXISTS trg_forbid_delete_finance_payments ON public.finance_payments;
CREATE TRIGGER trg_forbid_delete_finance_titles BEFORE DELETE ON public.finance_titles
  FOR EACH ROW EXECUTE FUNCTION public.forbid_finance_delete();
CREATE TRIGGER trg_forbid_delete_finance_installments BEFORE DELETE ON public.finance_installments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_finance_delete();
CREATE TRIGGER trg_forbid_delete_finance_payments BEFORE DELETE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_finance_delete();

-- 5) TRANSIÇÕES E IMUTABILIDADE -----------------------------
CREATE OR REPLACE FUNCTION public.finance_title_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean := false;
BEGIN
  NEW.updated_at := now();

  IF OLD.status IN ('pago','estornado','cancelado')
     AND (NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.kind        IS DISTINCT FROM OLD.kind
       OR NEW.client_id   IS DISTINCT FROM OLD.client_id
       OR NEW.event_id    IS DISTINCT FROM OLD.event_id
       OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
       OR NEW.quote_id    IS DISTINCT FROM OLD.quote_id
       OR NEW.supplier_name IS DISTINCT FROM OLD.supplier_name
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_id   IS DISTINCT FROM OLD.source_id) THEN
    RAISE EXCEPTION 'Título % está % e não pode ter dados materiais alterados.', OLD.id, OLD.status;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := CASE OLD.status
      WHEN 'rascunho'  THEN NEW.status IN ('pendente','cancelado')
      WHEN 'pendente'  THEN NEW.status IN ('aprovado','pago','cancelado')
      WHEN 'aprovado'  THEN NEW.status IN ('pago','cancelado')
      WHEN 'pago'      THEN NEW.status IN ('estornado')
      ELSE false
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'Transição de status inválida: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.finance_installment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean := false;
BEGIN
  NEW.updated_at := now();

  IF OLD.status IN ('pago','cancelado')
     AND (NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.title_id IS DISTINCT FROM OLD.title_id
       OR NEW.number IS DISTINCT FROM OLD.number) THEN
    RAISE EXCEPTION 'Parcela % está % e não pode ter valor/vínculo alterado.', OLD.id, OLD.status;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := CASE OLD.status
      WHEN 'pendente' THEN NEW.status IN ('parcial','pago','cancelado')
      WHEN 'parcial'  THEN NEW.status IN ('pago','cancelado')
      WHEN 'pago'     THEN NEW.status IN ('parcial','pendente')
      ELSE false
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'Transição de status inválida na parcela: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_finance_title_guard ON public.finance_titles;
CREATE TRIGGER trg_finance_title_guard BEFORE UPDATE ON public.finance_titles
  FOR EACH ROW EXECUTE FUNCTION public.finance_title_guard();

DROP TRIGGER IF EXISTS trg_finance_installment_guard ON public.finance_installments;
CREATE TRIGGER trg_finance_installment_guard BEFORE UPDATE ON public.finance_installments
  FOR EACH ROW EXECUTE FUNCTION public.finance_installment_guard();

-- 6) PAGAMENTOS: SALDO COM LOCK, ESTORNO ÚNICO ---------------
CREATE OR REPLACE FUNCTION public.finance_payment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title    public.finance_titles%ROWTYPE;
  v_inst     public.finance_installments%ROWTYPE;
  v_paid     numeric(14,2);
  v_base     numeric(14,2);
  v_orig     public.finance_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_title FROM public.finance_titles WHERE id = NEW.title_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título inexistente.';
  END IF;

  IF NEW.installment_id IS NOT NULL THEN
    SELECT * INTO v_inst FROM public.finance_installments WHERE id = NEW.installment_id FOR UPDATE;
    IF NOT FOUND OR v_inst.title_id <> NEW.title_id THEN
      RAISE EXCEPTION 'Parcela inválida para este título.';
    END IF;
  END IF;

  IF NEW.is_reversal THEN
    IF NEW.reverses_payment_id IS NULL THEN
      RAISE EXCEPTION 'Estorno exige o pagamento de origem.';
    END IF;
    SELECT * INTO v_orig FROM public.finance_payments WHERE id = NEW.reverses_payment_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pagamento de origem inexistente.';
    END IF;
    IF v_orig.is_reversal THEN
      RAISE EXCEPTION 'Não é possível estornar um estorno.';
    END IF;
    IF v_orig.title_id <> NEW.title_id
       OR v_orig.installment_id IS DISTINCT FROM NEW.installment_id THEN
      RAISE EXCEPTION 'O estorno deve referenciar o mesmo título e parcela do pagamento original.';
    END IF;
    IF v_orig.amount <> NEW.amount THEN
      RAISE EXCEPTION 'O estorno deve ser pelo valor integral do pagamento original.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.finance_payments WHERE reverses_payment_id = NEW.reverses_payment_id) THEN
      RAISE EXCEPTION 'Este pagamento já possui estorno.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.reverses_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamento normal não pode referenciar estorno.';
  END IF;

  IF v_title.status IN ('cancelado','estornado') THEN
    RAISE EXCEPTION 'Título % não aceita pagamentos.', v_title.status;
  END IF;

  IF NEW.installment_id IS NOT NULL THEN
    IF v_inst.status = 'cancelado' THEN
      RAISE EXCEPTION 'Parcela cancelada não aceita pagamentos.';
    END IF;
    v_base := v_inst.amount;
    SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0)
      INTO v_paid FROM public.finance_payments WHERE installment_id = NEW.installment_id;
  ELSE
    v_base := v_title.total_amount;
    SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0)
      INTO v_paid FROM public.finance_payments WHERE title_id = NEW.title_id;
  END IF;

  IF v_base - v_paid <= 0 THEN
    RAISE EXCEPTION 'Não há saldo em aberto para receber pagamento.';
  END IF;

  IF NEW.amount > (v_base - v_paid) + 0.005 THEN
    RAISE EXCEPTION 'Pagamento (%) excede o saldo em aberto (%).', NEW.amount, v_base - v_paid;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_finance_payment_guard ON public.finance_payments;
CREATE TRIGGER trg_finance_payment_guard BEFORE INSERT ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_payment_guard();

CREATE OR REPLACE FUNCTION public.forbid_finance_payment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Pagamentos são imutáveis. Registre um estorno.';
END; $$;

DROP TRIGGER IF EXISTS trg_forbid_update_finance_payments ON public.finance_payments;
CREATE TRIGGER trg_forbid_update_finance_payments BEFORE UPDATE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_finance_payment_update();

-- 7) ANTI-DUPLICIDADE EM bank_transactions -------------------
CREATE OR REPLACE FUNCTION public.prevent_duplicate_bank_transaction_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_type IS NULL OR NEW.reference_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.reference_type IS NOT DISTINCT FROM OLD.reference_type
     AND NEW.reference_id   IS NOT DISTINCT FROM OLD.reference_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bank_transactions bt
     WHERE bt.reference_type = NEW.reference_type
       AND bt.reference_id   = NEW.reference_id
       AND bt.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe lançamento bancário para a origem %/%.', NEW.reference_type, NEW.reference_id;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_bank_transaction_reference ON public.bank_transactions;
CREATE TRIGGER trg_prevent_duplicate_bank_transaction_reference
  BEFORE INSERT OR UPDATE OF reference_type, reference_id ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_bank_transaction_reference();

-- 8) AUDITORIA REDIGIDA --------------------------------------
CREATE OR REPLACE FUNCTION public.record_finance_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_name    text;
  v_id      uuid;
  v_changed text[] := '{}';
  v_col     text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_name FROM public.user_credentials WHERE id = v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_id := NEW.id;
  ELSE
    v_id := NEW.id;
    FOR v_col IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF (to_jsonb(OLD) ->> v_col) IS DISTINCT FROM (to_jsonb(NEW) ->> v_col) THEN
        v_changed := array_append(v_changed, v_col);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    v_actor, v_name, TG_OP, TG_TABLE_NAME, v_id, NULL,
    jsonb_build_object('changed_fields', to_jsonb(v_changed), 'redacted', true)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_finance_titles ON public.finance_titles;
DROP TRIGGER IF EXISTS trg_audit_finance_installments ON public.finance_installments;
DROP TRIGGER IF EXISTS trg_audit_finance_payments ON public.finance_payments;
CREATE TRIGGER trg_audit_finance_titles AFTER INSERT OR UPDATE ON public.finance_titles
  FOR EACH ROW EXECUTE FUNCTION public.record_finance_audit();
CREATE TRIGGER trg_audit_finance_installments AFTER INSERT OR UPDATE ON public.finance_installments
  FOR EACH ROW EXECUTE FUNCTION public.record_finance_audit();
CREATE TRIGGER trg_audit_finance_payments AFTER INSERT ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.record_finance_audit();