-- Remover as duas despesas específicas do extrato da conta Itaú
DELETE FROM bank_transactions 
WHERE id IN (
  '1d7e7fa7-29e8-46a6-8e26-fe9fe29149b2', -- Despesa Fixa Mensal - Despesa (R$ 6.500,00)
  '1b2a2883-31b0-4450-98de-f39b3bf86af6'  -- Despesa Empresa - vale arthur (R$ 500,00)
);