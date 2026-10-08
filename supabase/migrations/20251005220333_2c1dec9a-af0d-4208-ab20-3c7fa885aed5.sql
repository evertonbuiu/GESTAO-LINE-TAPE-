-- Remover despesas duplicadas usando created_at para manter a mais recente
DELETE FROM public.event_expenses 
WHERE id IN (
  SELECT ee.id
  FROM public.event_expenses ee
  WHERE ee.reference_type = 'daily_rate'
    AND ee.reference_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.event_expenses ee2
      WHERE ee2.reference_type = 'daily_rate'
        AND ee2.reference_id = ee.reference_id
        AND ee2.created_at > ee.created_at
    )
);