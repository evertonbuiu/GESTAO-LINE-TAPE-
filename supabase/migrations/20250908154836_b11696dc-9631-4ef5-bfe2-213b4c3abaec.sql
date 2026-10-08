-- Remove duplicate event transactions with 'Receita' descriptions
-- These are causing duplicated entries in bank statements
DELETE FROM bank_transactions 
WHERE reference_type = 'event' 
  AND description LIKE 'Receita - %'
  AND transaction_type = 'income';