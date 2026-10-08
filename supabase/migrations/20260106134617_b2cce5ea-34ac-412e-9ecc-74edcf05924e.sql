-- Remover transação de "contas atrassadas"
DELETE FROM bank_transactions 
WHERE bank_account_id = '1cc4036f-a3cc-4422-bd9c-f6c266aee865'
AND description LIKE '%contas atrassadas%';