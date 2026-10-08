-- Corrigir a lógica de cálculo para evitar valores negativos incorretos
-- Quando não há equipamentos alocados, não deveria haver devoluções

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
        -- Garantir que nunca seja negativo
        net_rented := GREATEST(0, total_rented - total_returned);
        
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
        
        RAISE NOTICE 'Updated equipment % - Total: %, Rented: %, Returned: %, Maintenance: %, Net Rented: %, Available: %', 
                     equipment_name_to_update, equipment_record.total_stock, total_rented, total_returned, total_maintenance, net_rented,
                     (equipment_record.total_stock - net_rented - total_maintenance);
    ELSE
        RAISE WARNING 'Equipment not found: %', equipment_name_to_update;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Atualizar também a função de recálculo forçado
CREATE OR REPLACE FUNCTION public.force_recalculate_equipment_stock()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    eq_record RECORD;
    total_rented INTEGER;
    total_returned INTEGER;
    total_maintenance INTEGER;
    net_rented INTEGER;
BEGIN
    -- Para cada equipamento
    FOR eq_record IN SELECT * FROM public.equipment LOOP
        -- Calcular total alugado (incluindo allocated)
        SELECT COALESCE(SUM(quantity), 0) INTO total_rented
        FROM public.event_equipment
        WHERE equipment_name = eq_record.name
        AND status IN ('confirmed', 'active', 'pending', 'allocated');
        
        -- Calcular total devolvido
        SELECT COALESCE(SUM(quantity), 0) INTO total_returned
        FROM public.event_equipment
        WHERE equipment_name = eq_record.name
        AND status = 'returned';
        
        -- Calcular equipamentos em manutenção
        SELECT COALESCE(SUM(quantity), 0) INTO total_maintenance
        FROM public.maintenance_records
        WHERE equipment_name = eq_record.name
        AND status IN ('agendada', 'em_andamento');
        
        -- Calcular líquido alugado - garantir que nunca seja negativo
        net_rented := GREATEST(0, total_rented - total_returned);
        
        UPDATE public.equipment 
        SET 
            rented = net_rented,
            available = total_stock - net_rented - total_maintenance,
            status = CASE 
                WHEN total_stock - net_rented - total_maintenance <= 0 THEN 'out_of_stock'
                WHEN total_stock - net_rented - total_maintenance <= total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = eq_record.id;
        
        RAISE NOTICE 'Recalculated equipment %: Total=%, Rented=%, Returned=%, Maintenance=%, Net=%, Available=%', 
                     eq_record.name, eq_record.total_stock, total_rented, total_returned, total_maintenance, net_rented,
                     (eq_record.total_stock - net_rented - total_maintenance);
    END LOOP;
        
    RAISE NOTICE 'Equipment stock recalculated for all items with corrected logic';
END;
$function$;