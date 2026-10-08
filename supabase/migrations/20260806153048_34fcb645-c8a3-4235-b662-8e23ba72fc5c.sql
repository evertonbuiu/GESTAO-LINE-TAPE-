-- 1) app_error_logs
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  stack text,
  route text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.app_error_logs TO authenticated;
GRANT ALL ON public.app_error_logs TO service_role;

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read error logs" ON public.app_error_logs;
CREATE POLICY "Admins can read error logs"
ON public.app_error_logs FOR SELECT TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users insert own error logs" ON public.app_error_logs;
CREATE POLICY "Users insert own error logs"
ON public.app_error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_app_error_logs_created_at ON public.app_error_logs (created_at DESC);

-- 2) audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);

-- 3) generic audit trigger
CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_name FROM public.user_credentials WHERE id = v_actor;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    IF v_old = v_new THEN
      RETURN NEW;
    END IF;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
  END IF;

  BEGIN
    v_entity_id := (COALESCE(v_new, v_old) ->> 'id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_entity_id := NULL;
  END;

  INSERT INTO public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_actor, v_name, TG_OP, TG_TABLE_NAME, v_entity_id, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) attach triggers to critical tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bank_accounts',
    'bank_transactions',
    'nfse_invoices',
    'recurring_expenses',
    'recurring_expense_monthly_payments',
    'equipment',
    'events',
    'clients',
    'user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.record_audit_log()',
        t
      );
    END IF;
  END LOOP;
END $$;