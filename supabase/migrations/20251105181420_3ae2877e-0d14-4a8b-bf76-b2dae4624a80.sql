-- Reset balance for Dinheiro em Caixa account
UPDATE bank_accounts 
SET balance = 0.00, updated_at = now()
WHERE name = 'Dinheiro em Caixa';