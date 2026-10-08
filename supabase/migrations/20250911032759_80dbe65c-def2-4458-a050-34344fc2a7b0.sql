-- Remove foreign key constraint that references auth.users table since we use custom auth
-- The created_by field can still store user IDs but won't enforce the foreign key constraint

-- Drop the foreign key constraint if it exists
ALTER TABLE public.bank_cards 
DROP CONSTRAINT IF EXISTS bank_cards_created_by_fkey;

-- Also make created_by nullable and add a default to prevent issues
ALTER TABLE public.bank_cards 
ALTER COLUMN created_by DROP NOT NULL;