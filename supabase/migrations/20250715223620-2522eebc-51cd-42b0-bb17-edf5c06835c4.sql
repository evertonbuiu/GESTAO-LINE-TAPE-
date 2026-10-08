-- Update the equipment stock trigger to properly handle returned equipment
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
    ) - (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.event_equipment
      WHERE equipment_name = (
        SELECT name FROM public.equipment WHERE id = 
          CASE 
            WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
            ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
          END
      )
      AND status = 'returned'
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
    ) + (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.event_equipment
      WHERE equipment_name = (
        SELECT name FROM public.equipment WHERE id = 
          CASE 
            WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
            ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
          END
      )
      AND status = 'returned'
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
      ) + (
        SELECT COALESCE(SUM(quantity), 0)
        FROM public.event_equipment
        WHERE equipment_name = (
          SELECT name FROM public.equipment WHERE id = 
            CASE 
              WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
              ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
            END
        )
        AND status = 'returned'
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
      ) + (
        SELECT COALESCE(SUM(quantity), 0)
        FROM public.event_equipment
        WHERE equipment_name = (
          SELECT name FROM public.equipment WHERE id = 
            CASE 
              WHEN TG_OP = 'DELETE' THEN (SELECT id FROM public.equipment WHERE name = OLD.equipment_name)
              ELSE (SELECT id FROM public.equipment WHERE name = COALESCE(NEW.equipment_name, OLD.equipment_name))
            END
        )
        AND status = 'returned'
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