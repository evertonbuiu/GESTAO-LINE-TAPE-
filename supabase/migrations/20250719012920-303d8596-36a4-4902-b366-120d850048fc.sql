-- Create function to update equipment availability based on maintenance
CREATE OR REPLACE FUNCTION public.update_equipment_with_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    equipment_name_to_update TEXT;
    total_maintenance_qty INTEGER;
    equipment_record RECORD;
BEGIN
    -- Determinar qual equipamento atualizar baseado na operação
    IF TG_OP = 'DELETE' THEN
        equipment_name_to_update := OLD.equipment_name;
    ELSE
        equipment_name_to_update := NEW.equipment_name;
    END IF;
    
    -- Buscar informações do equipamento
    SELECT id, name, total_stock, rented 
    INTO equipment_record
    FROM public.equipment 
    WHERE name = equipment_name_to_update
    LIMIT 1;
    
    -- Se encontrou o equipamento, calcular manutenções ativas
    IF equipment_record.id IS NOT NULL THEN
        -- Calcular total de equipamentos em manutenção (agendada ou em andamento)
        SELECT COALESCE(SUM(quantity), 0) INTO total_maintenance_qty
        FROM public.maintenance_records
        WHERE equipment_name = equipment_name_to_update
        AND status IN ('agendada', 'em_andamento');
        
        -- Atualizar equipamento com nova disponibilidade
        -- Available = Total Stock - Rented - In Maintenance
        UPDATE public.equipment 
        SET 
            available = equipment_record.total_stock - equipment_record.rented - total_maintenance_qty,
            status = CASE 
                WHEN (equipment_record.total_stock - equipment_record.rented - total_maintenance_qty) <= 0 THEN 'out_of_stock'
                WHEN (equipment_record.total_stock - equipment_record.rented - total_maintenance_qty) <= equipment_record.total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_record.id;
        
        RAISE NOTICE 'Updated equipment % - Total: %, Rented: %, Maintenance: %, Available: %', 
                     equipment_name_to_update, 
                     equipment_record.total_stock, 
                     equipment_record.rented, 
                     total_maintenance_qty,
                     (equipment_record.total_stock - equipment_record.rented - total_maintenance_qty);
    ELSE
        RAISE WARNING 'Equipment not found: %', equipment_name_to_update;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintenance changes
DROP TRIGGER IF EXISTS trigger_update_equipment_on_maintenance_change ON public.maintenance_records;
CREATE TRIGGER trigger_update_equipment_on_maintenance_change
    AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_with_maintenance();

-- Run initial calculation to update all equipment with maintenance quantities
DO $$
DECLARE
    equipment_record RECORD;
    total_maintenance_qty INTEGER;
BEGIN
    FOR equipment_record IN SELECT * FROM public.equipment LOOP
        -- Calculate maintenance quantity for this equipment
        SELECT COALESCE(SUM(quantity), 0) INTO total_maintenance_qty
        FROM public.maintenance_records
        WHERE equipment_name = equipment_record.name
        AND status IN ('agendada', 'em_andamento');
        
        -- Update equipment availability
        UPDATE public.equipment 
        SET 
            available = equipment_record.total_stock - equipment_record.rented - total_maintenance_qty,
            status = CASE 
                WHEN (equipment_record.total_stock - equipment_record.rented - total_maintenance_qty) <= 0 THEN 'out_of_stock'
                WHEN (equipment_record.total_stock - equipment_record.rented - total_maintenance_qty) <= equipment_record.total_stock * 0.2 THEN 'low_stock'
                ELSE 'available'
            END,
            updated_at = now()
        WHERE id = equipment_record.id;
    END LOOP;
    
    RAISE NOTICE 'Initial equipment availability calculation completed considering maintenance';
END $$;