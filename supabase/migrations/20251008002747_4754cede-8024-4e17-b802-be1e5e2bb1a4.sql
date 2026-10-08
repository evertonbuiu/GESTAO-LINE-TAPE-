-- Add bank_account_id column to daily_rates table
ALTER TABLE public.daily_rates 
ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id);