
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, service_role;

-- user_credentials
DROP POLICY IF EXISTS "Allow all operations on user_credentials" ON public.user_credentials;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;
GRANT SELECT (id, username, name, is_active, created_at, updated_at, last_login)
  ON public.user_credentials TO authenticated;
GRANT INSERT (id, username, name, is_active, password_hash, password_salt),
      UPDATE (username, name, is_active, password_hash, password_salt, last_login),
      DELETE
  ON public.user_credentials TO authenticated;
GRANT ALL ON public.user_credentials TO service_role;

CREATE POLICY "uc_select_self_or_admin" ON public.user_credentials
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());
CREATE POLICY "uc_admin_insert" ON public.user_credentials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "uc_admin_update" ON public.user_credentials
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "uc_admin_delete" ON public.user_credentials
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- user_roles
DROP POLICY IF EXISTS "Allow all operations on user_roles" ON public.user_roles;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
CREATE POLICY "ur_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());
CREATE POLICY "ur_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- user_permissions
DROP POLICY IF EXISTS "Allow all operations on user_permissions" ON public.user_permissions;
REVOKE ALL ON public.user_permissions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
CREATE POLICY "up_select_self_or_admin" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());
CREATE POLICY "up_admin_manage" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- role_permissions / permissions
DROP POLICY IF EXISTS "Allow all operations on role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Allow all operations on permissions" ON public.permissions;
REVOKE ALL ON public.role_permissions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
REVOKE ALL ON public.permissions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

CREATE POLICY "rp_read_authenticated" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_admin_write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "perm_read_authenticated" ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm_admin_write" ON public.permissions
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- profiles
DROP POLICY IF EXISTS "Allow all access" ON public.profiles;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY "profiles_read_all_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());
CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- bank_accounts / bank_transactions
DROP POLICY IF EXISTS "Allow all operations on bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Allow all operations on bank_transactions" ON public.bank_transactions;
REVOKE ALL ON public.bank_accounts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
REVOKE ALL ON public.bank_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
CREATE POLICY "bank_accounts_auth_all" ON public.bank_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bank_transactions_auth_all" ON public.bank_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- nfse_certificates
DROP POLICY IF EXISTS "nfse_certificates_select" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_insert" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_update" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_delete" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_select_anon" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_insert_anon" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_update_anon" ON public.nfse_certificates;
DROP POLICY IF EXISTS "nfse_certificates_delete_anon" ON public.nfse_certificates;
REVOKE ALL ON public.nfse_certificates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfse_certificates TO authenticated;
GRANT ALL ON public.nfse_certificates TO service_role;
CREATE POLICY "nfse_cert_admin_only" ON public.nfse_certificates
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
