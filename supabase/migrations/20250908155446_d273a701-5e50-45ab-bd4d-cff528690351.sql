-- Remover transações bancárias duplicadas que estão causando duplicação no extrato
-- Manter apenas o fluxo de caixa direto das tabelas originais
DELETE FROM bank_transactions 
WHERE reference_type IN ('expense', 'event', 'recurring_expense')
  AND (
    description LIKE 'Despesa Empresa - %' 
    OR description LIKE 'Receita - %'
    OR description LIKE '[Empresa] %'
    OR description LIKE '[Evento] %'
    OR description LIKE '[Despesa Fixa] %'
  );