-- Adicionar campos para pagamento do restante em eventos
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS remaining_payment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_payment_date date,
ADD COLUMN IF NOT EXISTS remaining_payment_bank_account text,
ADD COLUMN IF NOT EXISTS is_remaining_paid boolean DEFAULT false;