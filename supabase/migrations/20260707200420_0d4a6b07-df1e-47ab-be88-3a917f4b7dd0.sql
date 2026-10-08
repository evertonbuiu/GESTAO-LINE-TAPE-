
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all policies with role 'public' or 'anon' on the listed tables (open policies)
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        'public' = ANY(roles) OR 'anon' = ANY(roles)
      )
      AND tablename IN (
        'approval_requests','audit_log','bank_card_transactions','bank_cards',
        'client_advances','client_custom_items','clients','collaborator_advances',
        'collaborator_expense_advances','collaborator_food_allowances','collaborator_monthly_salaries',
        'collaborator_payments','collaborators','company_expenses','company_fixed_expense_monthly_payments',
        'company_fixed_expenses','company_settings','contract_attachments','contract_payments','contracts',
        'daily_rates','equipment','event_budgets','event_collaborators','event_contracts','event_equipment',
        'event_expenses','events','external_quotes','interstate_transports','maintenance_records',
        'nfse_config','nfse_invoices','patrimony_inventory','recurring_expense_monthly_payments',
        'recurring_expense_payment_plans','recurring_expenses','saved_bank_accounts','saved_signatures',
        'user_theme_preferences','whatsapp_messages','worker_advances','worker_expense_advances',
        'worker_food_allowances','workers'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

-- Ensure REVOKE anon on these tables (grants remain for authenticated + service_role)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'approval_requests','audit_log','bank_card_transactions','bank_cards',
    'client_advances','client_custom_items','clients','collaborator_advances',
    'collaborator_expense_advances','collaborator_food_allowances','collaborator_monthly_salaries',
    'collaborator_payments','collaborators','company_expenses','company_fixed_expense_monthly_payments',
    'company_fixed_expenses','company_settings','contract_attachments','contract_payments','contracts',
    'daily_rates','equipment','event_budgets','event_collaborators','event_contracts','event_equipment',
    'event_expenses','events','external_quotes','interstate_transports','maintenance_records',
    'nfse_config','nfse_invoices','patrimony_inventory','recurring_expense_monthly_payments',
    'recurring_expense_payment_plans','recurring_expenses','saved_bank_accounts','saved_signatures',
    'user_theme_preferences','whatsapp_messages','worker_advances','worker_expense_advances',
    'worker_food_allowances','workers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END$$;
