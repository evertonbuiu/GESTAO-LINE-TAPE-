-- Criar triggers para colaboradores
DROP TRIGGER IF EXISTS trigger_create_collaborator_from_daily_rate ON public.daily_rates;
CREATE TRIGGER trigger_create_collaborator_from_daily_rate
  AFTER INSERT ON public.daily_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.create_event_collaborator_from_daily_rate();

DROP TRIGGER IF EXISTS trigger_update_collaborator_from_daily_rate ON public.daily_rates;
CREATE TRIGGER trigger_update_collaborator_from_daily_rate
  AFTER UPDATE ON public.daily_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_collaborator_from_daily_rate();

DROP TRIGGER IF EXISTS trigger_delete_collaborator_from_daily_rate ON public.daily_rates;
CREATE TRIGGER trigger_delete_collaborator_from_daily_rate
  BEFORE DELETE ON public.daily_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_event_collaborator_from_daily_rate();