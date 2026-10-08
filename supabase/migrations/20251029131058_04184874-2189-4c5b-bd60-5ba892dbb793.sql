-- Drop existing policy for worker_expense_advances
DROP POLICY IF EXISTS "Allow all access to worker expense advances" ON worker_expense_advances;

-- Create specific policies for worker_expense_advances
CREATE POLICY "Users can view worker expense advances"
ON worker_expense_advances
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert worker expense advances"
ON worker_expense_advances
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update worker expense advances"
ON worker_expense_advances
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can delete worker expense advances"
ON worker_expense_advances
FOR DELETE
TO authenticated
USING (true);