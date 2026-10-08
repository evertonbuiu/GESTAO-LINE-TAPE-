-- Drop the authenticated-only policies
DROP POLICY IF EXISTS "Users can view worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can insert worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can update worker expense advances" ON worker_expense_advances;
DROP POLICY IF EXISTS "Users can delete worker expense advances" ON worker_expense_advances;

-- Create policies that work with custom auth (no Supabase auth required)
CREATE POLICY "Enable all access for worker expense advances"
ON worker_expense_advances
FOR ALL
USING (true)
WITH CHECK (true);