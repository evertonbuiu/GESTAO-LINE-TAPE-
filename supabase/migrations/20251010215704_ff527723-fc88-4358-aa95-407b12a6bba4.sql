-- Update bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'expense-receipts';