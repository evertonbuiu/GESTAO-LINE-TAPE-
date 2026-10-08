
DROP TRIGGER IF EXISTS trg_update_event_totals ON public.event_expenses;
CREATE TRIGGER trg_update_event_totals
AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_event_totals();

-- Recalcular totais para todos os eventos existentes
UPDATE public.events e
SET total_expenses = COALESCE(sub.total, 0),
    profit_margin = COALESCE(e.total_budget, 0) - COALESCE(sub.total, 0),
    updated_at = now()
FROM (
  SELECT event_id, SUM(total_price) AS total
  FROM public.event_expenses
  WHERE event_id IS NOT NULL
  GROUP BY event_id
) sub
WHERE e.id = sub.event_id;
