-- Limpar todas as transações da conta c6bank
DELETE FROM bank_transactions 
WHERE bank_account_id = '1cc4036f-a3cc-4422-bd9c-f6c266aee865';

-- Atualizar o saldo da conta para 0
UPDATE bank_accounts 
SET balance = 0, updated_at = now()
WHERE id = '1cc4036f-a3cc-4422-bd9c-f6c266aee865';