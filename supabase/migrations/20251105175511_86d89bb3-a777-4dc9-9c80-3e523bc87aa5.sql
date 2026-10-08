-- Enable RLS policies for bank_transactions table
DROP POLICY IF EXISTS "Allow all access to bank transactions" ON public.bank_transactions;

CREATE POLICY "Allow all access to bank transactions"
ON public.bank_transactions
FOR ALL
USING (true)
WITH CHECK (true);