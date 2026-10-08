-- Adicionar novos campos à tabela external_quotes para informações adicionais do orçamento
ALTER TABLE public.external_quotes 
ADD COLUMN IF NOT EXISTS client_document TEXT, -- CPF/CNPJ
ADD COLUMN IF NOT EXISTS client_address TEXT, -- Endereço completo  
ADD COLUMN IF NOT EXISTS initial_setup_date DATE, -- Data inicial de montagem
ADD COLUMN IF NOT EXISTS event_name TEXT, -- Nome do evento
ADD COLUMN IF NOT EXISTS technical_responsible TEXT; -- Responsável técnico

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.external_quotes.client_document IS 'CPF ou CNPJ do cliente';
COMMENT ON COLUMN public.external_quotes.client_address IS 'Endereço completo do cliente';
COMMENT ON COLUMN public.external_quotes.initial_setup_date IS 'Data inicial de montagem do evento';
COMMENT ON COLUMN public.external_quotes.event_name IS 'Nome do evento';
COMMENT ON COLUMN public.external_quotes.technical_responsible IS 'Responsável técnico do evento';