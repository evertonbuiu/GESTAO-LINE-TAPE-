-- Atualizar transações bancárias existentes de "Vale" para "Adiantamento"

-- Atualizar descrições de transações de colaboradores
UPDATE public.bank_transactions
SET 
  description = REPLACE(description, 'Vale - ', 'Adiantamento - '),
  category = 'Adiantamentos de Colaboradores'
WHERE reference_type = 'collaborator_advance' 
  AND description LIKE 'Vale - %';

-- Atualizar descrições de transações de diaristas
UPDATE public.bank_transactions
SET 
  description = REPLACE(description, 'Vale - ', 'Adiantamento - '),
  category = 'Adiantamentos de Diaristas'
WHERE reference_type = 'worker_advance' 
  AND description LIKE 'Vale - %';