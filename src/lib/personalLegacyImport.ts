/**
 * Importação opcional dos gastos pessoais antigos guardados em localStorage.
 * NUNCA apaga os dados locais — apenas lê e normaliza.
 */

export interface LegacyPersonalExpense {
  description: string;
  amount_cents: number;
  expense_date: string;
  payment_method: string | null;
  notes: string | null;
  legacy_category: string | null;
}

const KEY_PREFIX = "personal_expenses_";

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function normalizeAmountCents(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/** Lê todas as chaves `personal_expenses_*` e devolve registros válidos e deduplicados. */
export function collectLegacyLocalExpenses(
  storage: Pick<Storage, "getItem" | "length" | "key"> | undefined =
    typeof window !== "undefined" ? window.localStorage : undefined,
): LegacyPersonalExpense[] {
  if (!storage) return [];
  const out: LegacyPersonalExpense[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(storage.getItem(key) ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    for (const raw of parsed) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const expense_date = normalizeDate(item.date);
      const amount_cents = normalizeAmountCents(item.amount);
      const description =
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : null;
      if (!expense_date || !amount_cents || !description) continue;

      const dedupeKey = `${expense_date}|${description.toLowerCase()}|${amount_cents}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      out.push({
        description,
        amount_cents,
        expense_date,
        payment_method:
          typeof item.paymentMethod === "string" && item.paymentMethod ? item.paymentMethod : null,
        notes: typeof item.notes === "string" && item.notes ? item.notes : null,
        legacy_category:
          typeof item.category === "string" && item.category ? item.category : null,
      });
    }
  }

  return out.sort((a, b) => a.expense_date.localeCompare(b.expense_date));
}
