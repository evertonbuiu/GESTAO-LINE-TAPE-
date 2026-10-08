
-- Remover a transação bancária duplicada (lançamento de colaborador vinculado a evento)
-- Esta transação está duplicando porque já existe em event_expenses
DELETE FROM bank_transactions 
WHERE id = '171e2045-3f66-41ff-83ed-a3b0c7cf3c64';

-- Atualizar o saldo da conta bancária C6 BANK LINE TAPE
UPDATE bank_accounts 
SET balance = (
    SELECT COALESCE(SUM(CASE WHEN bt.transaction_type = 'income' THEN bt.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN bt.transaction_type = 'expense' THEN bt.amount ELSE 0 END), 0)
    FROM bank_transactions bt
    WHERE bt.bank_account_id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71'
),
current_balance = (
    SELECT COALESCE(SUM(CASE WHEN bt.transaction_type = 'income' THEN bt.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN bt.transaction_type = 'expense' THEN bt.amount ELSE 0 END), 0)
    FROM bank_transactions bt
    WHERE bt.bank_account_id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71'
),
updated_at = now()
WHERE id = 'cda74c16-6ac1-4247-b323-6ebe5f22ce71';
