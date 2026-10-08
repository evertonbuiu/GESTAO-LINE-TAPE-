-- Criar função para forçar recálculo manual do estoque
CREATE OR REPLACE FUNCTION public.force_recalculate_equipment_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualizar todos os equipamentos baseado nos event_equipment
    UPDATE public.equipment 
    SET 
        rented = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM public.event_equipment
            WHERE equipment_name = equipment.name
            AND status IN ('confirmed', 'active', 'pending')
        ),
        available = total_stock - (
            SELECT COALESCE(SUM(quantity), 0)
            FROM public.event_equipment
            WHERE equipment_name = equipment.name
            AND status IN ('confirmed', 'active', 'pending')
        ),
        status = CASE 
            WHEN total_stock - (
                SELECT COALESCE(SUM(quantity), 0)
                FROM public.event_equipment
                WHERE equipment_name = equipment.name
                AND status IN ('confirmed', 'active', 'pending')
            ) <= 0 THEN 'out_of_stock'
            WHEN total_stock - (
                SELECT COALESCE(SUM(quantity), 0)
                FROM public.event_equipment
                WHERE equipment_name = equipment.name
                AND status IN ('confirmed', 'active', 'pending')
            ) <= total_stock * 0.2 THEN 'low_stock'
            ELSE 'available'
        END,
        updated_at = now();
        
    RAISE NOTICE 'Equipment stock recalculated successfully';
END;
$$;

-- Executar a função para recalcular tudo
SELECT public.force_recalculate_equipment_stock();