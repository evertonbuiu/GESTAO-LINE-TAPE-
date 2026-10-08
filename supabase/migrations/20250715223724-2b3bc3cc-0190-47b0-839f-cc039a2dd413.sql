-- Force update all equipment stock to recalculate with the new logic
UPDATE public.equipment 
SET 
  rented = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.event_equipment
    WHERE equipment_name = equipment.name
    AND status IN ('confirmed', 'active')
  ) - (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.event_equipment
    WHERE equipment_name = equipment.name
    AND status = 'returned'
  ),
  available = total_stock - (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.event_equipment
    WHERE equipment_name = equipment.name
    AND status IN ('confirmed', 'active')
  ) + (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.event_equipment
    WHERE equipment_name = equipment.name
    AND status = 'returned'
  ),
  updated_at = now();

-- Update status based on availability
UPDATE public.equipment 
SET status = CASE 
  WHEN available = 0 THEN 'out_of_stock'
  WHEN available <= total_stock * 0.2 THEN 'low_stock'
  ELSE 'available'
END
WHERE status != CASE 
  WHEN available = 0 THEN 'out_of_stock'
  WHEN available <= total_stock * 0.2 THEN 'low_stock'
  ELSE 'available'
END;