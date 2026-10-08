-- Function to update equipment stock based on event_equipment changes
CREATE OR REPLACE FUNCTION public.update_equipment_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update equipment availability based on event_equipment allocations
  UPDATE public.equipment 
  SET 
    rented = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.event_equipment
      WHERE equipment_name = (
        SELECT name FROM public.equipment WHERE id = 
          CASE 
            WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
            ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
          END
      )
      AND status IN ('confirmed', 'active')
    ),
    available = total_stock - (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.event_equipment
      WHERE equipment_name = (
        SELECT name FROM public.equipment WHERE id = 
          CASE 
            WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
            ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
          END
      )
      AND status IN ('confirmed', 'active')
    ),
    status = CASE 
      WHEN total_stock - (
        SELECT COALESCE(SUM(quantity), 0)
        FROM public.event_equipment
        WHERE equipment_name = (
          SELECT name FROM public.equipment WHERE id = 
            CASE 
              WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
              ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
            END
        )
        AND status IN ('confirmed', 'active')
      ) = 0 THEN 'out_of_stock'
      WHEN total_stock - (
        SELECT COALESCE(SUM(quantity), 0)
        FROM public.event_equipment
        WHERE equipment_name = (
          SELECT name FROM public.equipment WHERE id = 
            CASE 
              WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
              ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
            END
        )
        AND status IN ('confirmed', 'active')
      ) <= total_stock * 0.2 THEN 'low_stock'
      ELSE 'available'
    END,
    updated_at = now()
  WHERE name = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.equipment_name
    ELSE COALESCE(NEW.equipment_name, OLD.equipment_name)
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stock updates
DROP TRIGGER IF EXISTS update_equipment_stock_trigger ON public.event_equipment;
CREATE TRIGGER update_equipment_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.event_equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_equipment_stock();