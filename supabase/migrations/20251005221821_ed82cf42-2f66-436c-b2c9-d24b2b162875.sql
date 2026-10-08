-- First, link old daily rate expenses to their corresponding daily_rates records
-- This will allow the triggers to work correctly when updating daily rates

UPDATE public.event_expenses ee
SET 
  reference_type = 'daily_rate',
  reference_id = dr.id
FROM public.daily_rates dr
WHERE ee.description LIKE 'Diária - %'
  AND ee.category = 'Diárias'
  AND (ee.reference_type IS NULL OR ee.reference_type = '')
  AND ee.event_id = dr.event_id
  AND ee.expense_date = dr.date
  AND ee.description = 'Diária - ' || dr.worker_name;

-- Delete any remaining duplicate daily rate expenses that couldn't be linked
-- (these are likely orphaned expenses from deleted daily rates)
DELETE FROM public.event_expenses
WHERE category = 'Diárias'
  AND description LIKE 'Diária - %'
  AND (reference_type IS NULL OR reference_type = '');