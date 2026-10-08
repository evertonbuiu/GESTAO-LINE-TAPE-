REVOKE ALL ON FUNCTION public.force_reconciliation_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.force_closing_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_closing_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ledger_extra_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_bank_period_closing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_bank_period_closed(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bank_period_closed(uuid, date) TO authenticated;