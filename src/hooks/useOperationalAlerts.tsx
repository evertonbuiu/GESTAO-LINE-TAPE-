import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMaintenanceAlerts,
  buildReturnAlerts,
  buildStockAlerts,
  buildUpcomingEventAlerts,
  sortAlerts,
  type OperationalAlert,
} from "@/lib/alerts";

interface State {
  alerts: OperationalAlert[];
  loading: boolean;
  error: string | null;
}

const in48h = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
};

/** Carrega os alertas operacionais com consultas enxutas e filtradas no banco. */
export const useOperationalAlerts = (enabled = true) => {
  const [state, setState] = useState<State>({ alerts: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 7);

      const [equipment, eventEquipment, maintenance, events] = await Promise.all([
        supabase
          .from("equipment")
          .select("id, name, available, min_stock")
          .gt("min_stock", 0)
          .limit(200),
        supabase
          .from("event_equipment")
          .select("id, event_id, equipment_name, quantity, status, events!inner(name, event_date)")
          .neq("status", "returned")
          .lt("events.event_date", today)
          .limit(200),
        supabase
          .from("maintenance_records")
          .select("id, equipment_name, scheduled_date, status")
          .lte("scheduled_date", weekAhead.toISOString().slice(0, 10))
          .limit(200),
        supabase
          .from("events")
          .select("id, name, event_date, event_time, status, client_name")
          .gte("event_date", today)
          .lte("event_date", in48h())
          .limit(100),
      ]);

      const firstError =
        equipment.error || eventEquipment.error || maintenance.error || events.error;
      if (firstError) throw firstError;

      const alerts = sortAlerts([
        ...buildStockAlerts(equipment.data ?? []),
        ...buildReturnAlerts((eventEquipment.data ?? []) as never),
        ...buildMaintenanceAlerts(maintenance.data ?? []),
        ...buildUpcomingEventAlerts((events.data ?? []) as never),
      ]);

      setState({ alerts, loading: false, error: null });
    } catch {
      setState({ alerts: [], loading: false, error: "Não foi possível carregar os alertas." });
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ alerts: [], loading: false, error: null });
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  return { ...state, reload: load };
};
