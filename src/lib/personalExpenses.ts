/**
 * Gastos Pessoais — regras puras (centavos + datas America/Sao_Paulo).
 * Nenhuma dependência de Supabase aqui para permitir testes isolados.
 */

export type PersonalKind = "expense" | "income";
export type PersonalFrequency = "weekly" | "monthly" | "yearly";

export interface PersonalExpenseRow {
  id: string;
  owner_id: string;
  description: string;
  amount_cents: number;
  expense_date: string; // YYYY-MM-DD
  kind: PersonalKind;
  payment_method: string | null;
  installment_number: number | null;
  installment_total: number | null;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  recurrence_id: string | null;
  parent_id: string | null;
  reverses_id: string | null;
}

export interface PersonalCategoryRow {
  id: string;
  name: string;
  kind: PersonalKind;
  color: string | null;
  archived: boolean;
}

export interface PersonalBudgetRow {
  id: string;
  category_id: string | null;
  month: string; // YYYY-MM-01
  limit_cents: number;
  active: boolean;
}

/* -------------------------------------------------- valores */

export const SP_TIMEZONE = "America/Sao_Paulo";

/** Converte reais (float vindo do CurrencyInput) para centavos inteiros. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* -------------------------------------------------- datas */

/** Data de hoje em São Paulo no formato YYYY-MM-DD (sem shift de fuso). */
export function todaySP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Primeiro e último dia (YYYY-MM-DD) do mês informado. month: 1-12 */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** Chave de mês usada em personal_budgets (primeiro dia do mês). */
export function monthKey(year: number, month: number): string {
  return monthRange(year, month).start;
}

/** Formata YYYY-MM-DD para DD/MM/YYYY sem criar Date (evita shift). */
export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Soma meses a uma data YYYY-MM-DD limitando ao último dia do mês destino. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/* -------------------------------------------------- estorno */

/** IDs de lançamentos estornados (originais) presentes na lista. */
export function reversedIds(rows: PersonalExpenseRow[]): Set<string> {
  const set = new Set<string>();
  for (const r of rows) if (r.reverses_id) set.add(r.reverses_id);
  return set;
}

export function isReversed(row: PersonalExpenseRow, rows: PersonalExpenseRow[]): boolean {
  return reversedIds(rows).has(row.id);
}

/**
 * Lançamentos que contam para totais: exclui o original estornado e o próprio estorno,
 * já que o par se anula.
 */
export function effectiveRows(rows: PersonalExpenseRow[]): PersonalExpenseRow[] {
  const reversed = reversedIds(rows);
  return rows.filter((r) => !r.reverses_id && !reversed.has(r.id));
}

/* -------------------------------------------------- totais */

export interface PersonalSummary {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  count: number;
}

export function summarize(rows: PersonalExpenseRow[]): PersonalSummary {
  const eff = effectiveRows(rows);
  let incomeCents = 0;
  let expenseCents = 0;
  for (const r of eff) {
    if (r.kind === "income") incomeCents += r.amount_cents;
    else expenseCents += r.amount_cents;
  }
  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    count: eff.length,
  };
}

export function totalsByCategory(
  rows: PersonalExpenseRow[],
  categories: PersonalCategoryRow[],
): { categoryId: string | null; name: string; cents: number }[] {
  const eff = effectiveRows(rows).filter((r) => r.kind === "expense");
  const byId = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string, number>();
  for (const r of eff) {
    const key = r.category_id ?? "__none__";
    acc.set(key, (acc.get(key) ?? 0) + r.amount_cents);
  }
  return Array.from(acc.entries())
    .map(([key, cents]) => ({
      categoryId: key === "__none__" ? null : key,
      name: key === "__none__" ? "Sem categoria" : byId.get(key) ?? "Categoria removida",
      cents,
    }))
    .sort((a, b) => b.cents - a.cents);
}

export interface BudgetStatus {
  categoryId: string | null;
  name: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  usedPercent: number;
  exceeded: boolean;
}

export function budgetStatuses(
  budgets: PersonalBudgetRow[],
  rows: PersonalExpenseRow[],
  categories: PersonalCategoryRow[],
  month: string,
): BudgetStatus[] {
  const byId = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  const spend = new Map<string, number>();
  for (const r of effectiveRows(rows)) {
    if (r.kind !== "expense") continue;
    const key = r.category_id ?? "__none__";
    spend.set(key, (spend.get(key) ?? 0) + r.amount_cents);
  }
  return budgets
    .filter((b) => b.active && b.month === month)
    .map((b) => {
      const key = b.category_id ?? "__none__";
      const spentCents = spend.get(key) ?? 0;
      return {
        categoryId: b.category_id,
        name: b.category_id ? byId.get(b.category_id) ?? "Categoria" : "Geral",
        limitCents: b.limit_cents,
        spentCents,
        remainingCents: b.limit_cents - spentCents,
        usedPercent: b.limit_cents > 0 ? Math.round((spentCents / b.limit_cents) * 100) : 0,
        exceeded: spentCents > b.limit_cents,
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);
}

/* -------------------------------------------------- parcelas e recorrência */

export interface InstallmentPart {
  expense_date: string;
  amount_cents: number;
  installment_number: number;
  installment_total: number;
}

/** Divide o total em N parcelas mensais sem perder centavos (resto na primeira). */
export function buildInstallments(
  totalCents: number,
  count: number,
  firstDate: string,
): InstallmentPart[] {
  if (count < 1) throw new Error("Número de parcelas inválido");
  if (totalCents <= 0) throw new Error("Valor deve ser maior que zero");
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const parts: InstallmentPart[] = [];
  for (let i = 0; i < count; i++) {
    parts.push({
      expense_date: addMonths(firstDate, i),
      amount_cents: base + (i === 0 ? remainder : 0),
      installment_number: i + 1,
      installment_total: count,
    });
  }
  return parts;
}

/** Datas geradas por uma recorrência dentro de um intervalo fechado. */
export function recurrenceOccurrences(
  params: {
    frequency: PersonalFrequency;
    start_date: string;
    end_date?: string | null;
  },
  rangeStart: string,
  rangeEnd: string,
  maxItems = 500,
): string[] {
  const out: string[] = [];
  let cursor = params.start_date;
  const hardEnd = params.end_date && params.end_date < rangeEnd ? params.end_date : rangeEnd;
  let guard = 0;
  while (cursor <= hardEnd && guard < maxItems) {
    if (cursor >= rangeStart) out.push(cursor);
    cursor =
      params.frequency === "weekly"
        ? addDays(cursor, 7)
        : params.frequency === "monthly"
          ? addMonths(cursor, 1)
          : addMonths(cursor, 12);
    guard++;
  }
  return out;
}

/* -------------------------------------------------- validação */

export interface ExpenseDraft {
  description: string;
  amount_cents: number;
  expense_date: string;
  kind: PersonalKind;
  installment_number?: number | null;
  installment_total?: number | null;
}

/** Espelha as CHECK constraints do banco para feedback imediato na UI. */
export function validateExpenseDraft(draft: ExpenseDraft): string[] {
  const errors: string[] = [];
  if (!draft.description?.trim()) errors.push("Informe uma descrição.");
  if (!Number.isInteger(draft.amount_cents) || draft.amount_cents <= 0) {
    errors.push("O valor deve ser maior que zero.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expense_date)) errors.push("Data inválida.");
  const n = draft.installment_number ?? null;
  const t = draft.installment_total ?? null;
  if ((n === null) !== (t === null)) {
    errors.push("Informe número e total de parcelas juntos.");
  } else if (n !== null && t !== null) {
    if (t < 1 || n < 1 || n > t) errors.push("Parcela inválida para o total informado.");
  }
  return errors;
}

/** Monta o estorno (natureza oposta e mesmo valor), conforme regra do banco. */
export function buildReversal(original: PersonalExpenseRow): {
  description: string;
  amount_cents: number;
  expense_date: string;
  kind: PersonalKind;
  category_id: string | null;
  account_id: string | null;
  reverses_id: string;
} {
  return {
    description: `Estorno — ${original.description}`,
    amount_cents: original.amount_cents,
    expense_date: todaySP(),
    kind: original.kind === "expense" ? "income" : "expense",
    category_id: original.category_id,
    account_id: original.account_id,
    reverses_id: original.id,
  };
}

/* -------------------------------------------------- exportação */

export function toCsv(rows: PersonalExpenseRow[], categories: PersonalCategoryRow[]): string {
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  const header = ["Data", "Descrição", "Categoria", "Tipo", "Forma", "Parcela", "Valor"];
  const lines = rows.map((r) => [
    formatDateBR(r.expense_date),
    r.description.replace(/;/g, ","),
    r.category_id ? byId.get(r.category_id) ?? "" : "",
    r.kind === "income" ? "Receita" : "Gasto",
    r.payment_method ?? "",
    r.installment_total ? `${r.installment_number}/${r.installment_total}` : "",
    (r.amount_cents / 100).toFixed(2).replace(".", ","),
  ]);
  return [header, ...lines].map((cols) => cols.join(";")).join("\n");
}
