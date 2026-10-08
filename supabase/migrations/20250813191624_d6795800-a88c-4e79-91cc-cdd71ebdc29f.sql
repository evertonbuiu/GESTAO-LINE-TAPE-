-- Adicionar campos para controle de pagamento das despesas fixas
ALTER TABLE public.recurring_expenses 
ADD COLUMN is_paid boolean DEFAULT false,
ADD COLUMN payment_date date,
ADD COLUMN payment_bank_account text;