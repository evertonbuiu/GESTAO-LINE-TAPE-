-- Corrigir e ressincronizar transações bancárias
-- Primeiro, vamos limpar as transações automáticas e recriar

-- Limpar transações automáticas
DELETE FROM public.bank_transactions WHERE reference_type IN ('event', 'expense');

-- Recriar transações chamando a função de sincronização
SELECT public.sync_bank_transactions();

-- Atualizar os saldos das contas baseado nas transações corrigidas
SELECT public.update_all_account_balances_from_transactions();