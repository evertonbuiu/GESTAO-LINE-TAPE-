-- Criar campo separado para controle de pagamento
ALTER TABLE public.events 
ADD COLUMN is_paid BOOLEAN DEFAULT false,
ADD COLUMN payment_date DATE;

-- Atualizar eventos que já têm status "pago"
UPDATE public.events 
SET is_paid = true, 
    payment_date = CURRENT_DATE 
WHERE status = 'paid';

-- Atualizar status dos eventos que estavam como "pago" para "completed"
UPDATE public.events 
SET status = 'completed' 
WHERE status = 'paid';