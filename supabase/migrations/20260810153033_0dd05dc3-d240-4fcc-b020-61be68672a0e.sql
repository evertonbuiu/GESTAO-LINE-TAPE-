REVOKE ALL ON FUNCTION public.next_quote_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_quote_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO service_role;