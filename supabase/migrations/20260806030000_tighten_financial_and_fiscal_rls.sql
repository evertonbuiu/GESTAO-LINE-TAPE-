-- Remove policies that accidentally let every authenticated account manage
-- bank and fiscal data. Access is limited to admin/financeiro roles.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['bank_accounts', 'bank_transactions', 'nfse_config', 'nfse_invoices'])
      AND policyname <> 'Financeiro full access'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', item.policyname, item.tablename);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Financeiro full access" ON public.bank_accounts;
DROP POLICY IF EXISTS "Financeiro full access" ON public.bank_transactions;
DROP POLICY IF EXISTS "Financeiro full access" ON public.nfse_config;
DROP POLICY IF EXISTS "Financeiro full access" ON public.nfse_invoices;

CREATE POLICY "Financeiro full access" ON public.bank_accounts
FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin', 'financeiro']))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin', 'financeiro']));

CREATE POLICY "Financeiro full access" ON public.bank_transactions
FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin', 'financeiro']))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin', 'financeiro']));

CREATE POLICY "Financeiro full access" ON public.nfse_config
FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin', 'financeiro']))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin', 'financeiro']));

CREATE POLICY "Financeiro full access" ON public.nfse_invoices
FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin', 'financeiro']))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin', 'financeiro']));

