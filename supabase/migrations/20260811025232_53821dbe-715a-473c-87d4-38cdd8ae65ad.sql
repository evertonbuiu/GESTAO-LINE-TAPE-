-- =========================================================
-- GASTOS PESSOAIS — owner-only, histórico protegido, aditivo/idempotente
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.personal_category_kind AS ENUM ('expense','income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.personal_recurrence_freq AS ENUM ('weekly','monthly','yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.force_personal_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.owner_id := COALESCE(auth.uid(), NEW.owner_id);
    IF NEW.owner_id IS NULL THEN
      RAISE EXCEPTION 'owner_id obrigatorio';
    END IF;
  ELSE
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.force_personal_owner() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_personal_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_personal_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------- TABELAS ----------
CREATE TABLE IF NOT EXISTS public.personal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'wallet',
  initial_balance_cents bigint NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_accounts_id_owner_key UNIQUE (id, owner_id)
);
GRANT SELECT, INSERT, UPDATE ON public.personal_accounts TO authenticated;
GRANT ALL ON public.personal_accounts TO service_role;
ALTER TABLE public.personal_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  kind public.personal_category_kind NOT NULL DEFAULT 'expense',
  color text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_categories_id_owner_key UNIQUE (id, owner_id)
);
GRANT SELECT, INSERT, UPDATE ON public.personal_categories TO authenticated;
GRANT ALL ON public.personal_categories TO service_role;
ALTER TABLE public.personal_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL,
  frequency public.personal_recurrence_freq NOT NULL DEFAULT 'monthly',
  day_of_period smallint,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  category_id uuid,
  account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_recurrences_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT personal_recurrences_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT personal_recurrences_period_valid CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE ON public.personal_recurrences TO authenticated;
GRANT ALL ON public.personal_recurrences TO service_role;
ALTER TABLE public.personal_recurrences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL,
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  kind public.personal_category_kind NOT NULL DEFAULT 'expense',
  payment_method text,
  installment_number smallint,
  installment_total smallint,
  notes text,
  category_id uuid,
  account_id uuid,
  recurrence_id uuid,
  parent_id uuid,
  reverses_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_expenses_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT personal_expenses_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT personal_expenses_installments_valid CHECK (
    (installment_number IS NULL AND installment_total IS NULL)
    OR (
      installment_number IS NOT NULL AND installment_total IS NOT NULL
      AND installment_total >= 1
      AND installment_number >= 1
      AND installment_number <= installment_total
    )
  ),
  CONSTRAINT personal_expenses_not_self_reference CHECK (
    (reverses_id IS NULL OR reverses_id <> id)
    AND (parent_id IS NULL OR parent_id <> id)
  )
);
GRANT SELECT, INSERT, UPDATE ON public.personal_expenses TO authenticated;
GRANT ALL ON public.personal_expenses TO service_role;
ALTER TABLE public.personal_expenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  category_id uuid,
  month date NOT NULL,
  limit_cents bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_budgets_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT personal_budgets_limit_positive CHECK (limit_cents > 0)
);
GRANT SELECT, INSERT, UPDATE ON public.personal_budgets TO authenticated;
GRANT ALL ON public.personal_budgets TO service_role;
ALTER TABLE public.personal_budgets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_expense_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_expense_attachments_id_owner_key UNIQUE (id, owner_id)
);
ALTER TABLE public.personal_expense_attachments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_expense_attachments TO authenticated;
GRANT ALL ON public.personal_expense_attachments TO service_role;
ALTER TABLE public.personal_expense_attachments ENABLE ROW LEVEL SECURITY;

-- ---------- FKs COMPOSTAS (integridade por proprietário) ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('personal_recurrences','personal_recurrences_category_owner_fk','category_id','personal_categories'),
      ('personal_recurrences','personal_recurrences_account_owner_fk','account_id','personal_accounts'),
      ('personal_expenses','personal_expenses_category_owner_fk','category_id','personal_categories'),
      ('personal_expenses','personal_expenses_account_owner_fk','account_id','personal_accounts'),
      ('personal_expenses','personal_expenses_recurrence_owner_fk','recurrence_id','personal_recurrences'),
      ('personal_expenses','personal_expenses_parent_owner_fk','parent_id','personal_expenses'),
      ('personal_expenses','personal_expenses_reverses_owner_fk','reverses_id','personal_expenses'),
      ('personal_budgets','personal_budgets_category_owner_fk','category_id','personal_categories'),
      ('personal_expense_attachments','personal_expense_attachments_expense_owner_fk','expense_id','personal_expenses')
    ) AS t(tbl,cname,col,ref)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname='public' AND cl.relname=r.tbl AND c.conname=r.cname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, owner_id) REFERENCES public.%I (id, owner_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
        r.tbl, r.cname, r.col, r.ref
      );
    END IF;
  END LOOP;
END $$;

-- ---------- ÍNDICES ----------
CREATE INDEX IF NOT EXISTS idx_personal_accounts_owner ON public.personal_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_personal_categories_owner ON public.personal_categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_personal_recurrences_owner ON public.personal_recurrences(owner_id);
CREATE INDEX IF NOT EXISTS idx_personal_expenses_owner_date ON public.personal_expenses(owner_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_expenses_parent ON public.personal_expenses(parent_id);
CREATE INDEX IF NOT EXISTS idx_personal_budgets_owner_month ON public.personal_budgets(owner_id, month);
CREATE INDEX IF NOT EXISTS idx_personal_attachments_expense ON public.personal_expense_attachments(expense_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_budget_owner_cat_month
  ON public.personal_budgets(owner_id, category_id, month);
-- apenas um estorno por lançamento original
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_expenses_single_reversal
  ON public.personal_expenses(reverses_id) WHERE reverses_id IS NOT NULL;

-- ---------- TRIGGERS: owner + updated_at ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal_accounts','personal_categories','personal_recurrences',
                           'personal_expenses','personal_budgets','personal_expense_attachments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_owner ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_owner BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.force_personal_owner()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_personal_updated_at()', t, t);
  END LOOP;
END $$;

-- ---------- REGRAS DE ESTORNO / IMUTABILIDADE ----------
CREATE OR REPLACE FUNCTION public.validate_personal_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE orig public.personal_expenses%ROWTYPE;
BEGIN
  IF NEW.reverses_id IS NOT NULL THEN
    SELECT * INTO orig FROM public.personal_expenses WHERE id = NEW.reverses_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lancamento original inexistente';
    END IF;
    IF orig.owner_id <> NEW.owner_id THEN
      RAISE EXCEPTION 'Estorno deve pertencer ao mesmo proprietario';
    END IF;
    IF orig.reverses_id IS NOT NULL THEN
      RAISE EXCEPTION 'Nao e permitido estornar um estorno';
    END IF;
    IF NEW.kind = orig.kind THEN
      RAISE EXCEPTION 'Estorno deve ter natureza oposta ao lancamento original';
    END IF;
    IF NEW.amount_cents <> orig.amount_cents THEN
      RAISE EXCEPTION 'Estorno deve ter o mesmo valor do lancamento original';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.reverses_id IS DISTINCT FROM NEW.reverses_id THEN
      RAISE EXCEPTION 'Vinculo de estorno nao pode ser alterado';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.reverses_id IS NOT NULL THEN
    RAISE EXCEPTION 'Vinculo de estorno nao pode ser removido';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_personal_reversal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_personal_expenses_reversal_validate ON public.personal_expenses;
CREATE TRIGGER trg_personal_expenses_reversal_validate
  BEFORE INSERT OR UPDATE ON public.personal_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_personal_reversal();

CREATE OR REPLACE FUNCTION public.guard_personal_expense_reversed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.personal_expenses e WHERE e.reverses_id = NEW.id) THEN
    RAISE EXCEPTION 'Lancamento estornado nao pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_personal_expense_reversed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_personal_expenses_reversed_guard ON public.personal_expenses;
CREATE TRIGGER trg_personal_expenses_reversed_guard
  BEFORE UPDATE ON public.personal_expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_personal_expense_reversed();

-- ---------- RLS OWNER-ONLY, SEM DELETE (exceto anexos) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal_accounts','personal_categories','personal_recurrences',
                           'personal_expenses','personal_budgets','personal_expense_attachments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_own" ON public.%I FOR SELECT TO authenticated USING (owner_id = auth.uid())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_update_own" ON public.%I FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t, t);
    -- garante ausencia de policy/GRANT de DELETE herdada de execucoes anteriores
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON public.%I', t, t);
  END LOOP;
END $$;

REVOKE DELETE ON public.personal_accounts FROM authenticated;
REVOKE DELETE ON public.personal_categories FROM authenticated;
REVOKE DELETE ON public.personal_recurrences FROM authenticated;
REVOKE DELETE ON public.personal_expenses FROM authenticated;
REVOKE DELETE ON public.personal_budgets FROM authenticated;

-- unico DELETE permitido: anexos do proprio dono
DROP POLICY IF EXISTS "personal_expense_attachments_delete_own" ON public.personal_expense_attachments;
CREATE POLICY "personal_expense_attachments_delete_own"
  ON public.personal_expense_attachments FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
