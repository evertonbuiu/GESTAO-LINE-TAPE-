
CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = ANY(_roles)
  );
$$;

DO $$
DECLARE
  r RECORD;
  t TEXT;
  fin_tables TEXT[] := ARRAY[
    'bank_accounts','bank_transactions','bank_cards','bank_card_transactions',
    'company_expenses','company_fixed_expenses','company_fixed_expense_monthly_payments',
    'recurring_expenses','recurring_expense_monthly_payments','recurring_expense_payment_plans',
    'collaborator_advances','collaborator_expense_advances','collaborator_food_allowances',
    'collaborator_monthly_salaries','collaborator_payments',
    'worker_advances','worker_expense_advances','worker_food_allowances',
    'daily_rates','client_advances','contract_payments','event_expenses','event_budgets',
    'nfse_certificates','nfse_config','nfse_invoices',
    'saved_bank_accounts','external_quotes','audit_log','approval_requests'
  ];
  commercial_tables TEXT[] := ARRAY[
    'clients','events','contracts','contract_attachments','event_contracts',
    'client_custom_items','event_collaborators'
  ];
  equipment_tables TEXT[] := ARRAY[
    'equipment','maintenance_records','patrimony_inventory','event_equipment','interstate_transports'
  ];
  people_tables TEXT[] := ARRAY['collaborators','workers'];
  whatsapp_tables TEXT[] := ARRAY['whatsapp_messages','company_settings'];
  signatures_tables TEXT[] := ARRAY['saved_signatures'];
  personal_tables TEXT[] := ARRAY['user_theme_preferences'];
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename = ANY(
        fin_tables || commercial_tables || equipment_tables ||
        people_tables || whatsapp_tables || signatures_tables || personal_tables
      )
      AND policyname = 'Authenticated full access'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  FOREACH t IN ARRAY fin_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Financeiro full access" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))', t);
  END LOOP;

  FOREACH t IN ARRAY commercial_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Comercial write" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))', t);
    EXECUTE format(
      'CREATE POLICY "Comercial read" ON public.%I FOR SELECT TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'',''funcionario'',''deposito'']))', t);
  END LOOP;

  FOREACH t IN ARRAY equipment_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Equip write" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''funcionario'',''deposito'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'',''funcionario'',''deposito'']))', t);
    EXECUTE format(
      'CREATE POLICY "Equip read" ON public.%I FOR SELECT TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'',''funcionario'',''deposito'']))', t);
  END LOOP;

  FOREACH t IN ARRAY people_tables LOOP
    EXECUTE format(
      'CREATE POLICY "People write" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))', t);
    EXECUTE format(
      'CREATE POLICY "People read" ON public.%I FOR SELECT TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'',''funcionario'',''deposito'']))', t);
  END LOOP;

  FOREACH t IN ARRAY whatsapp_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Whats write" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'']))', t);
    EXECUTE format(
      'CREATE POLICY "Whats read" ON public.%I FOR SELECT TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'',''funcionario'']))', t);
  END LOOP;

  FOREACH t IN ARRAY signatures_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Signatures access" ON public.%I FOR ALL TO authenticated
       USING (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))
       WITH CHECK (public.current_user_has_any_role(ARRAY[''admin'',''financeiro'']))', t);
  END LOOP;

  FOREACH t IN ARRAY personal_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Own preferences" ON public.%I FOR ALL TO authenticated
       USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
  END LOOP;
END$$;
