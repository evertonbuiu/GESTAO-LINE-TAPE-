/** Regras puras de alertas operacionais (testáveis sem banco). */

export type AlertSeverity = "critical" | "warning" | "info";

export interface OperationalAlert {
  id: string;
  category: "estoque" | "devolucao" | "manutencao" | "evento";
  severity: AlertSeverity;
  title: string;
  description: string;
  tab: string;
  date?: string | null;
}

export interface EquipmentRow {
  id: string;
  name: string;
  available: number | null;
  min_stock: number | null;
}

export interface EventRow {
  id: string;
  name: string;
  event_date: string;
  event_time?: string | null;
  status?: string | null;
  client_name?: string | null;
}

export interface EventEquipmentRow {
  id: string;
  event_id: string;
  equipment_name: string;
  quantity: number;
  status: string;
  events?: { name: string | null; event_date: string | null } | null;
}

export interface MaintenanceRow {
  id: string;
  equipment_name: string;
  scheduled_date: string;
  status: string | null;
}

const dayDiff = (target: string, now: Date) => {
  const d = new Date(`${target}T00:00:00`);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - base.getTime()) / 86400000);
};

export const buildStockAlerts = (rows: EquipmentRow[]): OperationalAlert[] =>
  rows
    .filter((r) => (r.min_stock ?? 0) > 0 && (r.available ?? 0) <= (r.min_stock ?? 0))
    .map((r) => ({
      id: `stock-${r.id}`,
      category: "estoque" as const,
      severity: (r.available ?? 0) <= 0 ? ("critical" as const) : ("warning" as const),
      title: r.name,
      description: `Disponível ${r.available ?? 0} de mínimo ${r.min_stock}`,
      tab: "inventory",
    }));

export const buildReturnAlerts = (
  rows: EventEquipmentRow[],
  now = new Date(),
): OperationalAlert[] =>
  rows
    .filter((r) => {
      const eventDate = r.events?.event_date;
      if (!eventDate) return false;
      if (r.status === "returned") return false;
      return dayDiff(eventDate, now) < 0;
    })
    .map((r) => ({
      id: `ret-${r.id}`,
      category: "devolucao" as const,
      severity: "critical" as const,
      title: `${r.equipment_name} (${r.quantity}x)`,
      description: `Não devolvido — evento ${r.events?.name ?? ""} em ${r.events?.event_date}`,
      tab: "event-equipment",
      date: r.events?.event_date ?? null,
    }));

export const buildMaintenanceAlerts = (
  rows: MaintenanceRow[],
  now = new Date(),
): OperationalAlert[] =>
  rows
    .filter((r) => r.status !== "concluida" && r.status !== "cancelada")
    .map((r) => ({ row: r, diff: dayDiff(r.scheduled_date, now) }))
    .filter(({ diff }) => diff <= 7)
    .map(({ row, diff }) => ({
      id: `mnt-${row.id}`,
      category: "manutencao" as const,
      severity: diff < 0 ? ("critical" as const) : ("warning" as const),
      title: row.equipment_name,
      description:
        diff < 0
          ? `Manutenção vencida há ${Math.abs(diff)} dia(s)`
          : `Manutenção agendada em ${diff} dia(s)`,
      tab: "maintenance",
      date: row.scheduled_date,
    }));

export const buildUpcomingEventAlerts = (
  rows: EventRow[],
  now = new Date(),
): OperationalAlert[] =>
  rows
    .filter((r) => r.status !== "completed" && r.status !== "cancelled")
    .map((r) => ({ row: r, diff: dayDiff(r.event_date, now) }))
    .filter(({ diff }) => diff >= 0 && diff <= 2)
    .map(({ row, diff }) => ({
      id: `evt-${row.id}`,
      category: "evento" as const,
      severity: diff === 0 ? ("critical" as const) : ("info" as const),
      title: row.name,
      description:
        diff === 0
          ? `Hoje${row.event_time ? ` às ${row.event_time}` : ""} — ${row.client_name ?? "sem cliente"}`
          : `Em ${diff} dia(s) — ${row.client_name ?? "sem cliente"}`,
      tab: "rentals",
      date: row.event_date,
    }));

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const sortAlerts = (alerts: OperationalAlert[]): OperationalAlert[] =>
  [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
