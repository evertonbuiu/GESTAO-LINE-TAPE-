/**
 * Núcleo puro do módulo Relatórios.
 * Sem I/O: períodos (America/Sao_Paulo), filtros, agregações, comparação,
 * ordenação/paginação e exportação CSV pt-BR. Coberto por testes.
 */

import { todaySaoPaulo, formatDateBR, formatBRL, sumMoney, toCents, fromCents } from "@/lib/finance";

export { todaySaoPaulo, formatDateBR, formatBRL };

/* ------------------------------------------------------------------ datas */

export type PeriodPreset =
  | "hoje"
  | "7d"
  | "30d"
  | "mes"
  | "mes_anterior"
  | "trimestre"
  | "ano"
  | "custom";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Soma dias a uma data YYYY-MM-DD sem criar Date local (sem deslocamento de fuso). */
export const addDays = (iso: string, days: number): string => {
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + days * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const startOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;

export const endOfMonth = (iso: string): string => {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(last)}`;
};

/** Resolve o preset para um intervalo fechado [start, end] em São Paulo. */
export const resolvePeriod = (
  preset: PeriodPreset,
  custom?: Partial<DateRange>,
  reference: string = todaySaoPaulo(),
): DateRange => {
  switch (preset) {
    case "hoje":
      return { start: reference, end: reference };
    case "7d":
      return { start: addDays(reference, -6), end: reference };
    case "30d":
      return { start: addDays(reference, -29), end: reference };
    case "mes":
      return { start: startOfMonth(reference), end: endOfMonth(reference) };
    case "mes_anterior": {
      const prev = addDays(startOfMonth(reference), -1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "trimestre": {
      const [y, m] = reference.slice(0, 10).split("-").map(Number);
      const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const start = `${y}-${pad(firstMonth)}-01`;
      return { start, end: endOfMonth(`${y}-${pad(firstMonth + 2)}-01`) };
    }
    case "ano":
      return { start: `${reference.slice(0, 4)}-01-01`, end: `${reference.slice(0, 4)}-12-31` };
    case "custom":
    default:
      return {
        start: (custom?.start || "").slice(0, 10) || reference,
        end: (custom?.end || "").slice(0, 10) || reference,
      };
  }
};

/** Período imediatamente anterior, com a mesma quantidade de dias. */
export const previousPeriod = (range: DateRange): DateRange => {
  const days =
    Math.round(
      (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000,
    ) + 1;
  return { start: addDays(range.start, -days), end: addDays(range.start, -1) };
};

/** Extrai YYYY-MM-DD de qualquer data/timestamp sem converter fuso. */
export const dateOnly = (value?: string | null): string => (value ?? "").slice(0, 10);

export const inRange = (value: string | null | undefined, range: DateRange): boolean => {
  const d = dateOnly(value);
  if (!d) return false;
  return d >= range.start && d <= range.end;
};

export const monthKey = (value?: string | null): string => dateOnly(value).slice(0, 7);

export const formatMonthBR = (key: string): string => {
  const [y, m] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]}/${y?.slice(2)}` : key;
};

/* -------------------------------------------------------------- agregações */

export const sumBy = <T,>(rows: T[], pick: (row: T) => number | null | undefined): number =>
  sumMoney(rows.map((r) => Number(pick(r) ?? 0)));

export interface GroupTotal {
  key: string;
  label: string;
  total: number;
  count: number;
}

/** Agrupa e soma, ordenando do maior total para o menor. */
export const groupTotals = <T,>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  valueOf: (row: T) => number | null | undefined,
  fallbackLabel = "Sem categoria",
): GroupTotal[] => {
  const map = new Map<string, { total: number; count: number }>();
  rows.forEach((row) => {
    const label = (keyOf(row) || "").trim() || fallbackLabel;
    const acc = map.get(label) ?? { total: 0, count: 0 };
    acc.total += toCents(Number(valueOf(row) ?? 0));
    acc.count += 1;
    map.set(label, acc);
  });
  return Array.from(map.entries())
    .map(([label, v]) => ({ key: label, label, total: fromCents(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);
};

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  entrada: number;
  saida: number;
  saldo: number;
}

export const monthlySeries = (
  rows: Array<{ date?: string | null; amount: number; type: "income" | "expense" }>,
  range: DateRange,
): MonthlySeriesPoint[] => {
  const keys: string[] = [];
  let cursor = startOfMonth(range.start);
  while (cursor.slice(0, 7) <= range.end.slice(0, 7)) {
    keys.push(cursor.slice(0, 7));
    cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
  }
  const entrada = new Map(keys.map((k) => [k, 0]));
  const saida = new Map(keys.map((k) => [k, 0]));

  rows.forEach((r) => {
    const k = monthKey(r.date);
    const target = r.type === "income" ? entrada : saida;
    if (!target.has(k)) return;
    target.set(k, (target.get(k) ?? 0) + toCents(Number(r.amount ?? 0)));
  });

  return keys.map((month) => {
    const i = entrada.get(month) ?? 0;
    const o = saida.get(month) ?? 0;
    return {
      month,
      label: formatMonthBR(month),
      entrada: fromCents(i),
      saida: fromCents(o),
      saldo: fromCents(i - o),
    };
  });
};

/* -------------------------------------------------------------- comparação */

export interface Comparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null; // null quando não há base de comparação
  direction: "up" | "down" | "flat";
}

export const compare = (current: number, previous: number): Comparison => {
  const delta = fromCents(toCents(current) - toCents(previous));
  const deltaPercent =
    toCents(previous) === 0 ? null : Math.round((delta / Math.abs(previous)) * 1000) / 10;
  return {
    current,
    previous,
    delta,
    deltaPercent,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
};

export const formatDelta = (c: Comparison): string => {
  if (c.deltaPercent === null) return "sem base anterior";
  const sign = c.deltaPercent > 0 ? "+" : "";
  return `${sign}${c.deltaPercent.toString().replace(".", ",")}% vs. período anterior`;
};

export const formatPercent = (value: number, digits = 1): string =>
  `${value.toFixed(digits).replace(".", ",")}%`;

/* ------------------------------------------------- busca, ordenação, página */

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const searchRows = <T,>(rows: T[], term: string, fields: Array<keyof T>): T[] => {
  const q = normalize(term).trim();
  if (!q) return rows;
  const tokens = q.split(/\s+/);
  return rows.filter((row) => {
    const haystack = fields.map((f) => normalize(row[f])).join(" ");
    return tokens.every((t) => haystack.includes(t));
  });
};

export type SortDirection = "asc" | "desc";

export const sortRows = <T,>(rows: T[], field: keyof T, direction: SortDirection): T[] =>
  [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = normalize(av).localeCompare(normalize(bv), "pt-BR");
    return direction === "asc" ? cmp : -cmp;
  });

export const paginate = <T,>(rows: T[], page: number, pageSize: number): T[] => {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeSize;
  return rows.slice(start, start + safeSize);
};

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/* -------------------------------------------------------------------- CSV */

/** Número no padrão pt-BR (vírgula decimal) — o Excel BR lê como número. */
export const csvNumber = (value: number | null | undefined, digits = 2): string =>
  (Number(value ?? 0)).toFixed(digits).replace(".", ",");

export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
}

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com separador ";" e CRLF — compatível com Excel pt-BR. */
export const buildCsv = <T,>(rows: T[], columns: Array<CsvColumn<T>>): string => {
  const header = columns.map((c) => escapeCell(c.label)).join(";");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(";"));
  return [header, ...body].join("\r\n");
};

export const csvFileName = (slug: string, range: DateRange): string =>
  `${slug}-${range.start}-a-${range.end}.csv`;

/* ------------------------------------------------------- dados sensíveis */

/** Mascara documentos (CPF/CNPJ) mantendo apenas os últimos dígitos. */
export const maskDocument = (value?: string | null): string => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  return `***${digits.slice(-4)}`;
};
