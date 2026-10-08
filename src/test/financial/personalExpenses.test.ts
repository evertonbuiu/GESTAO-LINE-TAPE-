import { describe, it, expect } from "vitest";
import {
  PersonalBudgetRow,
  PersonalCategoryRow,
  PersonalExpenseRow,
  addMonths,
  buildInstallments,
  buildReversal,
  budgetStatuses,
  effectiveRows,
  formatDateBR,
  monthKey,
  monthRange,
  recurrenceOccurrences,
  summarize,
  toCents,
  toCsv,
  todaySP,
  totalsByCategory,
  validateExpenseDraft,
} from "@/lib/personalExpenses";
import { collectLegacyLocalExpenses } from "@/lib/personalLegacyImport";

const base: PersonalExpenseRow = {
  id: "1",
  owner_id: "u1",
  description: "Mercado",
  amount_cents: 10000,
  expense_date: "2026-03-10",
  kind: "expense",
  payment_method: "PIX",
  installment_number: null,
  installment_total: null,
  notes: null,
  category_id: "c1",
  account_id: null,
  recurrence_id: null,
  parent_id: null,
  reverses_id: null,
};

const categories: PersonalCategoryRow[] = [
  { id: "c1", name: "Alimentação", kind: "expense", color: null, archived: false },
  { id: "c2", name: "Transporte", kind: "expense", color: null, archived: false },
];

describe("valores em centavos", () => {
  it("converte reais para centavos sem erro de ponto flutuante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1234.56)).toBe(123456);
  });
});

describe("datas", () => {
  it("gera o intervalo do mês corretamente, inclusive fevereiro bissexto", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange(2024, 2).end).toBe("2024-02-29");
    expect(monthKey(2026, 7)).toBe("2026-07-01");
  });

  it("formata sem shift de fuso", () => {
    expect(formatDateBR("2026-01-01")).toBe("01/01/2026");
  });

  it("soma meses limitando ao último dia", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("todaySP devolve YYYY-MM-DD", () => {
    expect(todaySP(new Date("2026-03-10T02:00:00Z"))).toBe("2026-03-09");
  });
});

describe("totais e estorno", () => {
  const reversal: PersonalExpenseRow = {
    ...base,
    id: "2",
    kind: "income",
    reverses_id: "1",
    expense_date: "2026-03-12",
  };
  const income: PersonalExpenseRow = {
    ...base,
    id: "3",
    kind: "income",
    amount_cents: 50000,
    category_id: null,
  };

  it("exclui o par estornado dos totais", () => {
    const rows = [base, reversal, income];
    expect(effectiveRows(rows).map((r) => r.id)).toEqual(["3"]);
    expect(summarize(rows)).toEqual({
      incomeCents: 50000,
      expenseCents: 0,
      balanceCents: 50000,
      count: 1,
    });
  });

  it("saldo negativo é preservado", () => {
    expect(summarize([base]).balanceCents).toBe(-10000);
  });

  it("monta estorno com natureza oposta e mesmo valor", () => {
    const rev = buildReversal(base);
    expect(rev.kind).toBe("income");
    expect(rev.amount_cents).toBe(base.amount_cents);
    expect(rev.reverses_id).toBe("1");
  });

  it("agrupa gastos por categoria e trata sem categoria", () => {
    const rows = [base, { ...base, id: "9", category_id: null, amount_cents: 500 }];
    const totals = totalsByCategory(rows, categories);
    expect(totals[0]).toEqual({ categoryId: "c1", name: "Alimentação", cents: 10000 });
    expect(totals[1].name).toBe("Sem categoria");
  });
});

describe("orçamentos", () => {
  const budgets: PersonalBudgetRow[] = [
    { id: "b1", category_id: "c1", month: "2026-03-01", limit_cents: 8000, active: true },
    { id: "b2", category_id: "c2", month: "2026-02-01", limit_cents: 5000, active: true },
  ];

  it("calcula uso e excedente apenas do mês selecionado", () => {
    const res = budgetStatuses(budgets, [base], categories, "2026-03-01");
    expect(res).toHaveLength(1);
    expect(res[0].spentCents).toBe(10000);
    expect(res[0].exceeded).toBe(true);
    expect(res[0].remainingCents).toBe(-2000);
  });
});

describe("parcelas", () => {
  it("distribui centavos sem perda", () => {
    const parts = buildInstallments(10000, 3, "2026-01-31");
    expect(parts.map((p) => p.amount_cents)).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((s, p) => s + p.amount_cents, 0)).toBe(10000);
    expect(parts[1].expense_date).toBe("2026-02-28");
    expect(parts[2].installment_number).toBe(3);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => buildInstallments(0, 2, "2026-01-01")).toThrow();
    expect(() => buildInstallments(100, 0, "2026-01-01")).toThrow();
  });
});

describe("recorrência", () => {
  it("gera ocorrências mensais dentro do intervalo", () => {
    const occ = recurrenceOccurrences(
      { frequency: "monthly", start_date: "2026-01-05", end_date: null },
      "2026-02-01",
      "2026-04-30",
    );
    expect(occ).toEqual(["2026-02-05", "2026-03-05", "2026-04-05"]);
  });

  it("respeita data final da recorrência", () => {
    const occ = recurrenceOccurrences(
      { frequency: "weekly", start_date: "2026-01-01", end_date: "2026-01-15" },
      "2026-01-01",
      "2026-12-31",
    );
    expect(occ).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
  });
});

describe("validação (espelha as constraints do banco)", () => {
  it("recusa valor zero ou negativo", () => {
    expect(validateExpenseDraft({ ...base, amount_cents: 0 })).toContain(
      "O valor deve ser maior que zero.",
    );
    expect(validateExpenseDraft({ ...base, amount_cents: -1 }).length).toBeGreaterThan(0);
  });

  it("recusa parcelas incoerentes", () => {
    expect(
      validateExpenseDraft({ ...base, installment_number: 3, installment_total: 2 }),
    ).toContain("Parcela inválida para o total informado.");
    expect(
      validateExpenseDraft({ ...base, installment_number: 1, installment_total: null }),
    ).toContain("Informe número e total de parcelas juntos.");
  });

  it("aceita lançamento válido", () => {
    expect(validateExpenseDraft({ ...base, installment_number: 1, installment_total: 3 })).toEqual([]);
  });
});

describe("exportação CSV pt-BR", () => {
  it("usa ponto e vírgula e vírgula decimal", () => {
    const csv = toCsv([base], categories);
    const [header, line] = csv.split("\n");
    expect(header.split(";")[0]).toBe("Data");
    expect(line).toContain("10/03/2026");
    expect(line.endsWith("100,00")).toBe(true);
  });
});

describe("importação do localStorage", () => {
  function fakeStorage(entries: Record<string, unknown>) {
    const keys = Object.keys(entries);
    return {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => (k in entries ? JSON.stringify(entries[k]) : null),
    };
  }

  it("normaliza, ignora inválidos e deduplica", () => {
    const storage = fakeStorage({
      personal_expenses_3_2026: [
        { date: "2026-03-10", description: "Mercado", amount: 100, paymentMethod: "PIX" },
        { date: "2026-03-10", description: "Mercado", amount: 100 },
        { date: "invalida", description: "X", amount: 10 },
        { date: "2026-03-11", description: "", amount: 10 },
        { date: "2026-03-12", description: "Zerado", amount: 0 },
      ],
      outra_chave: [{ date: "2026-03-10", description: "Ignorar", amount: 5 }],
    });
    const rows = collectLegacyLocalExpenses(storage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Mercado",
      amount_cents: 10000,
      expense_date: "2026-03-10",
      payment_method: "PIX",
    });
  });

  it("devolve vazio sem storage", () => {
    expect(collectLegacyLocalExpenses(undefined)).toEqual([]);
  });
});
