import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REALTIME_TABLES = [
  "bank_accounts",
  "bank_transactions",
  "bank_cards",
  "bank_card_transactions",
  "clients",
  "collaborators",
  "company_expenses",
  "contracts",
  "daily_rates",
  "equipment",
  "event_budgets",
  "event_collaborators",
  "event_equipment",
  "event_expenses",
  "events",
  "external_quotes",
  "finance_installments",
  "finance_payments",
  "finance_titles",
  "interstate_transports",
  "maintenance_records",
  "nfse_invoices",
  "patrimony_inventory",
  "personal_accounts",
  "personal_budgets",
  "personal_expenses",
  "recurring_expenses",
  "workers",
] as const;

/**
 * Mantém consultas visíveis sincronizadas sem recarregar a aplicação inteira.
 * Um pequeno debounce agrupa importações e alterações em lote em um único refetch.
 */
export function RealtimeQuerySync() {
  const queryClient = useQueryClient();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({
          refetchType: "active",
          predicate: (query) => query.getObserversCount() > 0,
        });
        window.dispatchEvent(new CustomEvent("linetape:data-change"));
      }, 750);
    };

    let channel = supabase.channel("global-query-sync");
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const refreshWhenOnline = () => scheduleRefresh();

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}

