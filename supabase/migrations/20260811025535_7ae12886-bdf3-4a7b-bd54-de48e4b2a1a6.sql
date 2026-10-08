DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal_accounts','personal_categories','personal_recurrences',
                           'personal_expenses','personal_budgets','personal_expense_attachments']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;