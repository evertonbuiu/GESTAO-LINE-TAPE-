-- Corrigir a função para calcular corretamente equipamentos devolvidos
CREATE OR REPLACE FUNCTION public.update_equipment_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    equipment_id_to_update UUID;
    equipment_name_to_update TEXT;
    total_rented INTEGER;
    total_returned INTEGER;
    net_rented INTEGER;
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
        -- Calcular total alugado (todas as saídas)
        SELECT COALESCE(SUM(quantity), 0) INTO total_rented
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('confirmed', 'active', 'pending');
        
        -- Calcular total devolvido
        SELECT COALESCE(SUM(quantity), 0) INTO total_returned
        FROM public.event_equipment
        WHERE equipment_name = equipment_name_to_update
        AND status = 'returned';
        
        -- Calcular líquido alugado (alugado - devolvido)
        net_rented := total_rented - total_returned;
        
        UPDATE public.equipment 
        SET 
            rented = net_rented,
            available = total_stock - net_rented,
            status = CASE 
                WHEN total_stock - net_rented <= 0 THEN 'out_of_stock'
                WHEN total_stock - net_rented <= total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_id_to_update;
        
        RAISE NOTICE 'Updated equipment % - Total rented: %, Returned: %, Net rented: %', 
                     equipment_name_to_update, total_rented, total_returned, net_rented;
    ELSE
        RAISE WARNING 'Equipment not found: %', equipment_name_to_update;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Atualizar também a função de recálculo manual
CREATE OR REPLACE FUNCTION public.force_recalculate_equipment_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    eq_record RECORD;
    total_rented INTEGER;
    total_returned INTEGER;
    net_rented INTEGER;
BEGIN
    -- Para cada equipamento
    FOR eq_record IN SELECT * FROM public.equipment LOOP
        -- Calcular total alugado
        SELECT COALESCE(SUM(quantity), 0) INTO total_rented
        FROM public.event_equipment
        WHERE equipment_name = eq_record.name
        AND status IN ('confirmed', 'active', 'pending');
        
        -- Calcular total devolvido
        SELECT COALESCE(SUM(quantity), 0) INTO total_returned
        FROM public.event_equipment
        WHERE equipment_name = eq_record.name
        AND status = 'returned';
        
        -- Calcular líquido alugado
        net_rented := total_rented - total_returned;
        
        UPDATE public.equipment 
        SET 
            rented = net_rented,
            available = total_stock - net_rented,
            status = CASE 
                WHEN total_stock - net_rented <= 0 THEN 'out_of_stock'
                WHEN total_stock - net_rented <= total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = eq_record.id;
    END LOOP;
        
    RAISE NOTICE 'Equipment stock recalculated with returned items';
END;
$$;

-- Executar recálculo com a nova lógica
SELECT public.force_recalculate_equipment_stock();