ALTER TABLE public.collaborator_monthly_salaries 
ADD COLUMN is_paid boolean NOT NULL DEFAULT false,
ADD COLUMN payment_date date,
ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id);