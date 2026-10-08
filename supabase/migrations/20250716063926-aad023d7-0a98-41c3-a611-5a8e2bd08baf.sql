-- Função para devolver equipamentos automaticamente quando evento for concluído
CREATE OR REPLACE FUNCTION public.return_equipment_on_event_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se o evento foi marcado como concluído
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Marcar todos os equipamentos deste evento como devolvidos
        UPDATE public.event_equipment 
        SET 
            status = 'returned',
            updated_at = now()
        WHERE event_id = NEW.id 
        AND status IN ('confirmed', 'active', 'pending');
        
        RAISE NOTICE 'Equipment returned for completed event: %', NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para eventos
DROP TRIGGER IF EXISTS return_equipment_on_completion ON public.events;
CREATE TRIGGER return_equipment_on_completion
    AFTER UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.return_equipment_on_event_completion();