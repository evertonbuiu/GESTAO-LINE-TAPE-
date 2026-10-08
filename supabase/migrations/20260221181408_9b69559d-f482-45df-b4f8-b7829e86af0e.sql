-- Remove duplicate bank_transactions created by manual import when trigger already created one
-- Keep the trigger-generated "Vale - " transactions, delete the manual "Adiantamento:" ones
DELETE FROM public.bank_transactions 
WHERE id IN ('82447687-d098-4d61-bcd1-1e07596e8f79', '82aefbf6-522b-45e5-8ca7-e818adf33fe1');