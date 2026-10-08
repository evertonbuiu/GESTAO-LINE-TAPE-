
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bank_accounts','bank_transactions','events','event_expenses',
    'company_expenses','recurring_expenses','recurring_expense_monthly_payments',
    'worker_advances','worker_expense_advances','worker_food_allowances',
    'collaborator_advances','collaborator_expense_advances','collaborator_food_allowances',
    'collaborator_payments','collaborator_monthly_salaries','daily_rates',
    'patrimony_inventory','company_fixed_expense_monthly_payments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN others THEN RAISE NOTICE 'skip %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
