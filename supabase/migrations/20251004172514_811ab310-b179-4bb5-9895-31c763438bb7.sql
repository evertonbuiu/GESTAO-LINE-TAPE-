-- Remover despesas duplicadas mantendo apenas a primeira de cada grupo

-- Para company_expenses: Remover duplicata de "Consórcio jeep"
DELETE FROM public.company_expenses 
WHERE id = 'd77f0b3f-6446-433c-bcfa-1c6e5ce96e6f';

-- Para company_expenses: Remover duplicata de "HERBERT LUIS"  
DELETE FROM public.company_expenses
WHERE id = 'd9f48bdc-e8e6-4c3d-bf27-819da55ad820';

-- Para event_expenses: Remover duplicata de "Pagamento - arthur"
DELETE FROM public.event_expenses
WHERE id = '9d7869ad-7210-4f3e-b224-a8f6c3526bff';

-- Ressincronizar transações bancárias
SELECT public.sync_bank_transactions();