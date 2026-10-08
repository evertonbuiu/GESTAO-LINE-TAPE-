-- Deletar transações bancárias órfãs (sem adiantamento correspondente)

-- Deletar transações de worker_advance sem registro correspondente
DELETE FROM public.bank_transactions
WHERE reference_type = 'worker_advance' 
  AND reference_id NOT IN (SELECT id FROM public.worker_expense_advances);

-- Deletar transações de collaborator_advance sem registro correspondente  
DELETE FROM public.bank_transactions
WHERE reference_type = 'collaborator_advance' 
  AND reference_id NOT IN (SELECT id FROM public.collaborator_expense_advances);