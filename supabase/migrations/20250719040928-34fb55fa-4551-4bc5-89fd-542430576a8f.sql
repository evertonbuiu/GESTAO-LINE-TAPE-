-- Corrigir a função de atualização de estoque 
-- O problema é que estamos tentando acessar total_stock de uma variável incorreta

CREATE OR REPLACE FUNCTION public.update_equipment_stock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    equipment_id_to_update UUID;
    equipment_name_to_update TEXT;
    equipment_record RECORD;
    total_rented INTEGER;
    total_returned INTEGER;
    total_maintenance INTEGER;
    net_rented INTEGER;
BEGIN
    -- Determinar qual equipamento atualizar baseado na operação
    IF TG_OP = 'DELETE' THEN
        equipment_name_to_update := OLD.equipment_name;
    ELSE
        equipment_name_to_update := NEW.equipment_name;
    END IF;
    
    -- Buscar o equipamento completo pelo nome
    SELECT id, total_stock, name 
    INTO equipment_record
    FROM public.equipment 
    WHERE name = equipment_name_to_update
    LIMIT 1;
    
    -- Se encontrou o equipamento, atualizar os dados
    IF equipment_record.id IS NOT NULL THEN
        -- Calcular total alugado (todas as saídas - incluindo allocated, confirmed, active, pending)
        SELECT COALESCE(SUM(quantity), 0) INTO total_rented
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('confirmed', 'active', 'pending', 'allocated');
        
        -- Calcular total devolvido
        SELECT COALESCE(SUM(quantity), 0) INTO total_returned
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status = 'returned';
        
        -- Calcular equipamentos em manutenção
        SELECT COALESCE(SUM(quantity), 0) INTO total_maintenance
        FROM public.maintenance_records
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('agendada', 'em_andamento');
        
        -- Calcular líquido alugado (alugado - devolvido)
        net_rented := total_rented - total_returned;
        
        UPDATE public.equipment 
        SET 
            rented = net_rented,
            available = equipment_record.total_stock - net_rented - total_maintenance,
            status = CASE 
                WHEN equipment_record.total_stock - net_rented - total_maintenance <= 0 THEN 'out_of_stock'
                WHEN equipment_record.total_stock - net_rented - total_maintenance <= equipment_record.total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_record.id;
        
        RAISE NOTICE 'Updated equipment % - Total: %, Rented: %, Returned: %, Maintenance: %, Available: %', 
                     equipment_name_to_update, equipment_record.total_stock, total_rented, total_returned, total_maintenance,
                     (equipment_record.total_stock - net_rented - total_maintenance);
    ELSE
        RAISE WARNING 'Equipment not found: %', equipment_name_to_update;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;