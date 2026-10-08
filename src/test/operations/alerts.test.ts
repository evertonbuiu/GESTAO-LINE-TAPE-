import { describe, expect, it } from "vitest";
import {
  buildMaintenanceAlerts,
  buildReturnAlerts,
  buildStockAlerts,
  buildUpcomingEventAlerts,
  sortAlerts,
} from "@/lib/alerts";

const NOW = new Date("2026-06-10T12:00:00");

describe("alertas de estoque", () => {
  it("sinaliza itens no limite ou abaixo do mínimo", () => {
    const alerts = buildStockAlerts([
      { id: "1", name: "Refletor", available: 2, min_stock: 5 },
      { id: "2", name: "Cabo", available: 10, min_stock: 5 },
      { id: "3", name: "Trave", available: 0, min_stock: 1 },
      { id: "4", name: "Sem mínimo", available: 0, min_stock: 0 },
    ]);
    expect(alerts.map((a) => a.title)).toEqual(["Refletor", "Trave"]);
    expect(alerts[1].severity).toBe("critical");
  });
});

describe("alertas de devolução", () => {
  it("considera apenas eventos passados sem devolução", () => {
    const alerts = buildReturnAlerts(
      [
        {
          id: "a",
          event_id: "e1",
          equipment_name: "Moving",
          quantity: 4,
          status: "confirmed",
          events: { name: "Festa", event_date: "2026-06-01" },
        },
        {
          id: "b",
          event_id: "e2",
          equipment_name: "Par LED",
          quantity: 2,
          status: "returned",
          events: { name: "Show", event_date: "2026-06-01" },
        },
        {
          id: "c",
          event_id: "e3",
          equipment_name: "Cabo",
          quantity: 1,
          status: "confirmed",
          events: { name: "Futuro", event_date: "2026-06-20" },
        },
      ],
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain("Moving");
  });
});

describe("alertas de manutenção", () => {
  it("marca vencidas como críticas e próximas como atenção", () => {
    const alerts = buildMaintenanceAlerts(
      [
        { id: "1", equipment_name: "Mesa", scheduled_date: "2026-06-05", status: "agendada" },
        { id: "2", equipment_name: "Caixa", scheduled_date: "2026-06-13", status: "agendada" },
        { id: "3", equipment_name: "Antiga", scheduled_date: "2026-06-01", status: "concluida" },
        { id: "4", equipment_name: "Longe", scheduled_date: "2026-07-30", status: "agendada" },
      ],
      NOW,
    );
    expect(alerts).toHaveLength(2);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("warning");
  });
});

describe("alertas de eventos em 48h", () => {
  it("inclui somente eventos entre hoje e 2 dias", () => {
    const alerts = buildUpcomingEventAlerts(
      [
        { id: "1", name: "Hoje", event_date: "2026-06-10", status: "confirmed" },
        { id: "2", name: "Amanhã", event_date: "2026-06-11", status: "confirmed" },
        { id: "3", name: "Semana que vem", event_date: "2026-06-18", status: "confirmed" },
        { id: "4", name: "Cancelado", event_date: "2026-06-10", status: "cancelled" },
      ],
      NOW,
    );
    expect(alerts.map((a) => a.title)).toEqual(["Hoje", "Amanhã"]);
    expect(alerts[0].severity).toBe("critical");
  });
});

describe("ordenação", () => {
  it("coloca críticos primeiro", () => {
    const sorted = sortAlerts([
      { id: "a", category: "evento", severity: "info", title: "i", description: "", tab: "x" },
      { id: "b", category: "estoque", severity: "critical", title: "c", description: "", tab: "x" },
      { id: "c", category: "estoque", severity: "warning", title: "w", description: "", tab: "x" },
    ]);
    expect(sorted.map((s) => s.title)).toEqual(["c", "w", "i"]);
  });
});
