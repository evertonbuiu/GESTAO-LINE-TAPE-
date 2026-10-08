import { describe, expect, it } from "vitest";
import {
  buildAging,
  buildCommitments,
  buildDelinquency,
  buildEventResults,
  buildManagerialDre,
  buildReconciliation,
  cashFlowByMonth,
  classifyDreGroup,
  dedupeLedger,
  detectTransferIds,
  filterLedger,
  originKey,
  summarizeAging,
  summarizeLedger,
  type LedgerEntry,
} from "@/lib/financeReports";
import type { FinanceInstallment, FinancePayment, FinanceTitle } from "@/lib/finance";
import { buildCsv, csvNumber } from "@/lib/reports";

const entry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: over.id ?? "e1",
  date: "2026-03-10",
  description: "Lançamento",
  category: "Geral",
  type: "expense",
  amount: 100,
  accountId: "acc1",
  accountName: "C6",
  source: "bank_transactions",
  sourceId: over.sourceId ?? "s1",
  status: "realizado",
  ...over,
});

describe("deduplicação por origem", () => {
  it("usa reference_type/reference_id como identidade", () => {
    expect(
      originKey(entry({ referenceType: "event_expense", referenceId: "x1" })),
    ).toBe("event_expense:x1");
    expect(originKey(entry({ source: "company_expenses", sourceId: "c9" }))).toBe(
      "company_expenses:c9",
    );
  });

  it("banco vence o lançamento derivado da mesma origem", () => {
    const rows = [
      entry({
        id: "bank",
        source: "bank_transactions",
        sourceId: "b1",
        referenceType: "event_expense",
        referenceId: "x1",
      }),
      entry({ id: "derived", source: "event_expenses", sourceId: "x1" }),
    ];
    expect(dedupeLedger(rows).map((r) => r.id)).toEqual(["bank"]);
  });

  it("nunca deduplica por texto igual", () => {
    const rows = [
      entry({ id: "a", source: "company_expenses", sourceId: "1", description: "Aluguel" }),
      entry({ id: "b", source: "company_expenses", sourceId: "2", description: "Aluguel" }),
    ];
    expect(dedupeLedger(rows)).toHaveLength(2);
  });
});

describe("transferências entre contas", () => {
  it("detecta o par entrada/saída em contas diferentes", () => {
    const rows = [
      entry({ id: "out", type: "expense", accountId: "a", description: "Transferência", sourceId: "1" }),
      entry({ id: "in", type: "income", accountId: "b", description: "Transferência", sourceId: "2" }),
      entry({ id: "keep", type: "expense", amount: 50, sourceId: "3" }),
    ];
    const ids = detectTransferIds(rows);
    expect(ids.has("out")).toBe(true);
    expect(ids.has("in")).toBe(true);
    expect(ids.has("keep")).toBe(false);
    expect(summarizeLedger(rows).saidas).toBe(50);
  });
});

describe("totais e filtros", () => {
  const rows = [
    entry({ id: "1", sourceId: "1", type: "income", amount: 1000.1, category: "Receita" }),
    entry({ id: "2", sourceId: "2", type: "expense", amount: 0.2, category: "Diária" }),
    entry({ id: "3", sourceId: "3", type: "expense", amount: 0.1, date: "2026-04-02" }),
  ];

  it("soma em centavos sem erro de ponto flutuante", () => {
    const t = summarizeLedger(rows);
    expect(t.saidas).toBe(0.3);
    expect(t.saldo).toBe(999.8);
  });

  it("filtra por período, tipo, categoria e conta", () => {
    const range = { start: "2026-03-01", end: "2026-03-31" };
    expect(filterLedger(rows, { range })).toHaveLength(2);
    expect(filterLedger(rows, { range, type: "income" })).toHaveLength(1);
    // categoria compara sem acento/caixa
    expect(filterLedger(rows, { range, category: "diaria" })).toHaveLength(1);
    expect(filterLedger(rows, { range, category: "Outra" })).toHaveLength(0);

    expect(filterLedger(rows, { range, category: "Diária" })).toHaveLength(1);
    expect(filterLedger(rows, { range, accountId: "outra" })).toHaveLength(0);
  });
});

describe("DRE gerencial", () => {
  it("classifica categorias em grupos", () => {
    expect(classifyDreGroup("Impostos", "DAS")).toBe("imposto");
    expect(classifyDreGroup("Diárias", "")).toBe("custo_direto");
    expect(classifyDreGroup("Aluguel", "")).toBe("administrativa");
    expect(classifyDreGroup("Marketing", "")).toBe("comercial");
    expect(classifyDreGroup("Tarifa bancária", "")).toBe("financeira");
    expect(classifyDreGroup("Xyz", "")).toBe("outras");
  });

  it("calcula resultado e margens", () => {
    const dre = buildManagerialDre([
      entry({ id: "r", sourceId: "r", type: "income", amount: 1000, category: "Receita" }),
      entry({ id: "i", sourceId: "i", amount: 100, category: "Impostos" }),
      entry({ id: "c", sourceId: "c", amount: 300, category: "Diárias" }),
      entry({ id: "a", sourceId: "a", amount: 100, category: "Aluguel" }),
    ]);
    expect(dre.receitaBruta).toBe(1000);
    expect(dre.receitaLiquida).toBe(900);
    expect(dre.lucroBruto).toBe(600);
    expect(dre.resultado).toBe(500);
    expect(dre.margemLiquida).toBe(50);
  });
});

describe("fluxo de caixa por período", () => {
  it("acumula saldo mês a mês", () => {
    const rows = [
      entry({ id: "1", sourceId: "1", type: "income", amount: 500, date: "2026-01-05" }),
      entry({ id: "2", sourceId: "2", amount: 200, date: "2026-02-10" }),
    ];
    const flow = cashFlowByMonth(rows, { start: "2026-01-01", end: "2026-03-31" }, 100);
    expect(flow.map((f) => f.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(flow[0].acumulado).toBe(600);
    expect(flow[1].acumulado).toBe(400);
    expect(flow[2].saldo).toBe(0);
  });
});

describe("aging, inadimplência e comprometido", () => {
  const titles: FinanceTitle[] = [
    {
      id: "t1",
      kind: "receber",
      status: "pendente",
      description: "Evento A",
      total_amount: 1000,
      due_date: "2026-02-01",
    },
    {
      id: "t2",
      kind: "pagar",
      status: "pendente",
      description: "Fornecedor",
      total_amount: 400,
      due_date: "2026-04-01",
    },
    {
      id: "t3",
      kind: "receber",
      status: "cancelado",
      description: "Cancelado",
      total_amount: 900,
      due_date: "2026-01-01",
    },
  ];
  const installments: FinanceInstallment[] = [];
  const payments: FinancePayment[] = [
    { id: "p1", title_id: "t1", amount: 250, paid_at: "2026-02-01", is_reversal: false },
  ];

  const rows = buildAging(titles, installments, payments, "2026-03-10");

  it("ignora cancelados e considera apenas o saldo em aberto", () => {
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.titleId === "t1")?.valorAberto).toBe(750);
  });

  it("classifica faixas de atraso", () => {
    expect(rows.find((r) => r.titleId === "t1")?.faixa).toBe("31-60 dias");
    expect(rows.find((r) => r.titleId === "t2")?.faixa).toBe("A vencer");
  });

  it("resume por faixa", () => {
    const resumo = summarizeAging(rows.filter((r) => r.kind === "receber"));
    expect(resumo.total).toBe(750);
    expect(resumo.vencido).toBe(750);
    expect(resumo.aVencer).toBe(0);
  });

  it("calcula índice de inadimplência", () => {
    expect(buildDelinquency(rows, 250).indice).toBe(75);
  });

  it("separa previsto, vencido e comprometido", () => {
    const c = buildCommitments(rows, 1000);
    expect(c.previstoReceber).toBe(750);
    expect(c.previstoPagar).toBe(400);
    expect(c.vencidoPagar).toBe(0);
    expect(c.saldoProjetado).toBe(1350);
  });

  it("usa parcelas quando existirem", () => {
    const parcels: FinanceInstallment[] = [
      { id: "i1", title_id: "t2", number: 1, due_date: "2026-01-10", amount: 200, status: "pendente" },
      { id: "i2", title_id: "t2", number: 2, due_date: "2026-05-10", amount: 200, status: "pendente" },
    ];
    const r = buildAging([titles[1]], parcels, [], "2026-03-10");
    expect(r).toHaveLength(2);
    expect(r[0].diasAtraso).toBeGreaterThan(0);
  });
});

describe("estornos", () => {
  it("estorno devolve o saldo ao aberto", () => {
    const titles: FinanceTitle[] = [
      {
        id: "t1",
        kind: "receber",
        status: "pendente",
        description: "Evento",
        total_amount: 500,
        due_date: "2026-03-01",
      },
    ];
    const payments: FinancePayment[] = [
      { id: "p1", title_id: "t1", amount: 500, paid_at: "2026-03-01", is_reversal: false },
      {
        id: "p2",
        title_id: "t1",
        amount: 500,
        paid_at: "2026-03-05",
        is_reversal: true,
        reverses_payment_id: "p1",
      },
    ];
    expect(buildAging(titles, [], payments, "2026-03-10")[0].valorAberto).toBe(500);
  });
});

describe("resultado por evento", () => {
  it("consolida receita, custo e margem", () => {
    const rows = buildEventResults(
      [{ id: "ev1", name: "Show", event_date: "2026-03-01", total_budget: 2000 }],
      [
        entry({ id: "1", sourceId: "1", type: "income", amount: 1500, eventId: "ev1" }),
        entry({ id: "2", sourceId: "2", amount: 500, eventId: "ev1" }),
        entry({ id: "3", sourceId: "3", amount: 900, eventId: null }),
      ],
    );
    expect(rows[0].receita).toBe(1500);
    expect(rows[0].custo).toBe(500);
    expect(rows[0].margem).toBe(1000);
    expect(rows[0].margemPercentual).toBeCloseTo(66.7, 1);
  });
});

describe("conciliação", () => {
  it("marca conciliado, somente banco e somente sistema", () => {
    const rows = buildReconciliation([
      entry({
        id: "b1",
        source: "bank_transactions",
        sourceId: "b1",
        referenceType: "event_expense",
        referenceId: "x1",
      }),
      entry({ id: "d1", source: "event_expenses", sourceId: "x1" }),
      entry({ id: "d2", source: "company_expenses", sourceId: "c2", amount: 77 }),
      entry({ id: "b2", source: "bank_transactions", sourceId: "b2", amount: 999 }),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r.situacao]));
    expect(byId.get("d1")).toBe("conciliado");
    expect(byId.get("d2")).toBe("somente_sistema");
    expect(byId.get("b2")).toBe("somente_banco");
  });
});

describe("exportação CSV pt-BR", () => {
  it("usa vírgula decimal e separador ;", () => {
    expect(csvNumber(1234.5)).toBe("1234,50");
    const csv = buildCsv([{ a: "Café; teste", b: 1 }], [
      { key: "a", label: "Descrição", value: (r) => r.a },
      { key: "b", label: "Valor", value: (r) => csvNumber(r.b) },
    ]);
    expect(csv.split("\r\n")[0]).toBe("Descrição;Valor");
    expect(csv).toContain('"Café; teste";1,00');
  });
});

describe("permissões", () => {
  const canView = (role: string | null) => role === "admin" || role === "financeiro";
  it("somente admin e financeiro veem relatórios financeiros", () => {
    expect(canView("admin")).toBe(true);
    expect(canView("financeiro")).toBe(true);
    expect(canView("funcionario")).toBe(false);
    expect(canView("deposito")).toBe(false);
  });
});
