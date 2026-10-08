-- Remover transações duplicadas criadas manualmente para adiantamentos de despesa de diarista (worker_expense_advances)
-- Motivo: o insert em worker_expense_advances já possui trigger que cria bank_transactions.
-- Em alguns casos (WhatsAppSync) foi criado também um bank_transactions manual com reference_type = 'worker_advance', gerando duplicidade no extrato.

BEGIN;

-- 1) Apagar as transações bancárias manuais incorretas (mantemos as criadas pelo trigger)
DELETE FROM public.bank_transactions bt
WHERE bt.reference_type = 'worker_advance'
  AND bt.reference_id IN (SELECT id FROM public.worker_expense_advances)
  AND bt.description LIKE 'Adiantamento - %';

-- 2) (Opcional/segurança) Se sobrou algum registro com reference_type incorreto apontando para worker_expense_advances, corrigir
UPDATE public.bank_transactions bt
SET reference_type = 'worker_expense_advance'
WHERE bt.reference_type = 'worker_advance'
  AND bt.reference_id IN (SELECT id FROM public.worker_expense_advances);

COMMIT;