-- Primeiro, identificar e remover transações duplicadas, mantendo apenas a mais recente de cada reference_id
DELETE FROM bank_transactions 
WHERE id NOT IN (
  SELECT DISTINCT ON (reference_id) id 
  FROM bank_transactions 
  WHERE reference_id IS NOT NULL
  ORDER BY reference_id, created_at DESC
)
AND reference_id IS NOT NULL;

-- Adicionar constraint única para evitar duplicatas futuras
-- Usamos um índice único parcial para permitir múltiplos NULL em reference_id
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_reference_id_unique_idx 
ON bank_transactions (reference_id) 
WHERE reference_id IS NOT NULL;