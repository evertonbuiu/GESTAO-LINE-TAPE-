-- MantÃ©m as telas do Line Tape sincronizadas quando os dados mudam no Supabase.
-- A migraÃ§Ã£o Ã© idempotente para poder ser reaplicada com seguranÃ§a.
DO $$
DECLARE
  table_name text;
  realtime_tables text[] := ARRAY[
    'bank_accounts', 'bank_transactions', 'bank_cards', 'bank_card_transactions',
    'clients', 'collaborators', 'company_expenses', 'contracts', 'daily_rates',
    'equipment', 'event_budgets', 'event_collaborators', 'event_equipment',
    'event_expenses', 'events', 'external_quotes', 'finance_installments',
    'finance_payments', 'finance_titles', 'interstate_transports',
    'maintenance_records', 'nfse_invoices', 'patrimony_inventory',
    'personal_accounts', 'personal_budgets', 'personal_expenses',
    'recurring_expenses', 'workers'
  ];
BEGIN
  FOREACH table_name IN ARRAY realtime_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);

      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

