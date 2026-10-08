-- Allow funcionario/deposito roles to read event budgets and external quotes (materials only; app hides values in UI)
CREATE POLICY "Funcionario read event_budgets"
ON public.event_budgets
FOR SELECT
TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));

CREATE POLICY "Funcionario read external_quotes"
ON public.external_quotes
FOR SELECT
TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','financeiro','funcionario','deposito']));
