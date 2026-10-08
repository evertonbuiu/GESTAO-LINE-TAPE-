DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bank_accounts','bank_transactions','events','event_expenses','event_equipment',
    'company_expenses','recurring_expenses','recurring_expense_monthly_payments',
    'worker_advances','worker_expense_advances','worker_food_allowances',
    'collaborator_advances','collaborator_expense_advances','collaborator_food_allowances',
    'collaborator_payments','collaborator_monthly_salaries','daily_rates',
    'patrimony_inventory','company_fixed_expense_monthly_payments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;