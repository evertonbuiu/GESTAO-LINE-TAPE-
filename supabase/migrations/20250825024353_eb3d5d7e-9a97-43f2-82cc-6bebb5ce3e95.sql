-- Adicionar coluna image_url à tabela event_budgets
ALTER TABLE public.event_budgets 
ADD COLUMN image_url TEXT;