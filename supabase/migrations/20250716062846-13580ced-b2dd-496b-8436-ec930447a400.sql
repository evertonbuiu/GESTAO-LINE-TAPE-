-- Melhorar a função de atualização do estoque de equipamentos
CREATE OR REPLACE FUNCTION public.update_equipment_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    equipment_id_to_update UUID;
    equipment_name_to_update TEXT;
BEGIN
    -- Determinar qual equipamento atualizar baseado na operação
    IF TG_OP = 'DELETE' THEN
        equipment_name_to_update := OLD.equipment_name;
    ELSE
        equipment_name_to_update := NEW.equipment_name;
    END IF;
    
    -- Buscar o ID do equipamento pelo nome
    SELECT id INTO equipment_id_to_update 
    FROM public.equipment 
    WHERE name = equipment_name_to_update
    LIMIT 1;
    
    -- Se encontrou o equipamento, atualizar os dados
    IF equipment_id_to_update IS NOT NULL THEN
        UPDATE public.equipment 
        SET 
            rented = (
                SELECT COALESCE(SUM(quantity), 0)
                FROM public.event_equipment
                WHERE equipment_name = equipment_name_to_update
                AND status IN ('confirmed', 'active', 'pending')
            ),
            available = total_stock - (
                SELECT COALESCE(SUM(quantity), 0)
                FROM public.event_equipment
                WHERE equipment_name = equipment_name_to_update
                AND status IN ('confirmed', 'active', 'pending')
            ),
            status = CASE 
                WHEN total_stock - (
                    SELECT COALESCE(SUM(quantity), 0)
                    FROM public.event_equipment
                    WHERE equipment_name = equipment_name_to_update
                    AND status IN ('confirmed', 'active', 'pending')
                ) <= 0 THEN 'out_of_stock'
                WHEN total_stock - (
                    SELECT COALESCE(SUM(quantity), 0)
                    FROM public.event_equipment
                    WHERE equipment_name = equipment_name_to_update
                    AND status IN ('confirmed', 'active', 'pending')
                ) <= total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_id_to_update;
        
        -- Log para debug
        RAISE NOTICE 'Updated equipment % (ID: %) - Operation: %', equipment_name_to_update, equipment_id_to_update, TG_OP;
    ELSE
        RAISE WARNING 'Equipment not found: %', equipment_name_to_update;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;