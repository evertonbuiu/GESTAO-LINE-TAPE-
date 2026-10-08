
-- Atualizar notinhas antigas do KAIKY ALVES para adicionar reference_id e reference_type
UPDATE event_expenses
SET 
  reference_id = '8e09f89a-b047-4431-957a-ed033c70a3c0',
  reference_type = 'collaborator'
WHERE category = 'Despesas de Colaboradores'
  AND description LIKE 'KAIKY ALVES%'
  AND reference_id IS NULL;

-- Atualizar notinhas antigas do ARTHUR HENRIQUE para adicionar reference_id e reference_type
UPDATE event_expenses
SET 
  reference_id = '556d796b-1374-492a-acf9-4209d788e058',
  reference_type = 'collaborator'
WHERE category = 'Despesas de Colaboradores'
  AND description LIKE 'ARTHUR HENRIQUE%'
  AND reference_id IS NULL;
