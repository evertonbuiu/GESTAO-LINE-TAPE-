-- Desabilitar triggers temporariamente para investigar o problema
DROP TRIGGER IF EXISTS events_balance_update ON public.events;
DROP TRIGGER IF EXISTS expenses_balance_update ON public.event_expenses;

-- Verificar dados detalhados
-- 1. Ver todos os eventos
SELECT 'EVENTOS' as tipo, id, name, is_paid, payment_amount, total_budget, payment_bank_account, event_date
FROM public.events
ORDER BY event_date DESC;

-- 2. Ver todas as despesas  
SELECT 'DESPESAS' as tipo, id, description, total_price, expense_bank_account, category, created_at
FROM public.event_expenses
ORDER BY created_at DESC;