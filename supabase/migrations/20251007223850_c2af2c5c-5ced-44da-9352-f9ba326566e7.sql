-- Permitir valores NULL na coluna event_id para despesas não vinculadas a eventos
ALTER TABLE public.event_expenses 
ALTER COLUMN event_id DROP NOT NULL;