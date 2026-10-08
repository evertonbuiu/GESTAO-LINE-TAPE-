-- Verificar e atualizar constraint na tabela bank_transactions para incluir 'recurring_expense'
ALTER TABLE public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_reference_type_check;

-- Criar nova constraint que inclui 'recurring_expense'
ALTER TABLE public.bank_transactions 
ADD CONSTRAINT bank_transactions_reference_type_check 
CHECK (reference_type IN ('event', 'expense', 'recurring_expense') OR reference_type IS NULL);

-- Executar sincronização para atualizar as transações
SELECT public.sync_bank_transactions();