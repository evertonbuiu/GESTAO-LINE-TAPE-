import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildBudgetVsActual,
  buildInstallments,
  buildProjection,
  buildSnapshot,
  canTransitionInstallment,
  canTransitionTitle,
  dedupeBySource,
  derivedInstallmentStatus,
  derivedTitleStatus,
  formatDateBR,
  hasSource,
  isTitleMateriallyLocked,
  netPaid,
  openBalance,
  sumMoney,
  validatePayment,
  type FinanceInstallment,
  type FinancePayment,
  type FinanceTitle,
} from "@/lib/finance";

const title = (over: Partial<FinanceTitle> = {}): FinanceTitle => ({
  id: "t1",
  kind: "receber",
  status: "pendente",
  description: "Evento Casamento",
  total_amount: 1000,
  due_date: "2026-08-10",
  ...over,
});

const payment = (over: Partial<FinancePayment> = {}): FinancePayment => ({
  id: "p1",
  title_id: "t1",
  amount: 400,
  paid_at: "2026-08-01",
  is_reversal: false,
  ...over,
});

describe("cálculos monetários", () => {
  it("soma sem erro de ponto flutuante", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([1234.56, 7.44])).toBe(1242);
  });

  it("distribui parcelas sem perder centavos", () => {
    const parts = buildInstallments(100, 3, "2026-01-31");
    expect(parts.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(sumMoney(parts.map((p) => p.amount))).toBe(100);
    expect(parts.map((p) => p.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("rejeita parâmetros inválidos", () => {
    expect(() => buildInstallments(100, 0, "2026-01-01")).toThrow();
    expect(() => buildInstallments(0, 2, "2026-01-01")).toThrow();
  });
});

describe("datas locais", () => {
  it("formata sem deslocar o dia", () => {
    expect(formatDateBR("2026-03-01")).toBe("01/03/2026");
    expect(formatDateBR(null)).toBe("—");
  });

  it("soma meses respeitando o último dia", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 2)).toBe("2027-02-15");
  });
});

describe("saldos e estados", () => {
  const payments = [payment(), payment({ id: "p2", amount: 100 })];

  it("calcula líquido e saldo em aberto", () => {
    expect(netPaid(payments)).toBe(500);
    expect(openBalance(1000, payments)).toBe(500);
  });

  it("estorno reduz o líquido", () => {
    const withReversal = [...payments, payment({ id: "p3", amount: 400, is_reversal: true })];
    expect(netPaid(withReversal)).toBe(100);
    expect(openBalance(1000, withReversal)).toBe(900);
  });

  it("deriva status de parcela", () => {
    const inst: FinanceInstallment = {
      id: "i1",
      title_id: "t1",
      number: 1,
      due_date: "2026-08-10",
      amount: 500,
      status: "pendente",
    };
    expect(derivedInstallmentStatus(inst, [])).toBe("pendente");
    expect(
      derivedInstallmentStatus(inst, [payment({ installment_id: "i1", amount: 200 })]),
    ).toBe("parcial");
    expect(
      derivedInstallmentStatus(inst, [payment({ installment_id: "i1", amount: 500 })]),
    ).toBe("pago");
  });

  it("título só fica pago quando o saldo zera", () => {
    expect(derivedTitleStatus(title(), payments)).toBe("pendente");
    expect(derivedTitleStatus(title(), [payment({ amount: 1000 })])).toBe("pago");
    expect(derivedTitleStatus(title({ status: "cancelado" }), [])).toBe("cancelado");
  });
});

describe("transições de status", () => {
  it("aceita apenas caminhos válidos do título", () => {
    expect(canTransitionTitle("pendente", "aprovado")).toBe(true);
    expect(canTransitionTitle("pago", "estornado")).toBe(true);
    expect(canTransitionTitle("pago", "pendente")).toBe(false);
    expect(canTransitionTitle("cancelado", "pendente")).toBe(false);
  });

  it("aceita apenas caminhos válidos da parcela", () => {
    expect(canTransitionInstallment("pendente", "parcial")).toBe(true);
    expect(canTransitionInstallment("parcial", "pago")).toBe(true);
    expect(canTransitionInstallment("cancelado", "pago")).toBe(false);
  });

  it("bloqueia edição material em pago/estornado/cancelado", () => {
    expect(isTitleMateriallyLocked("pago")).toBe(true);
    expect(isTitleMateriallyLocked("estornado")).toBe(true);
    expect(isTitleMateriallyLocked("pendente")).toBe(false);
  });
});

describe("validação de pagamento", () => {
  it("impede sobrepagamento", () => {
    const r = validatePayment(title(), { amount: 700 }, [payment({ amount: 400 })]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/excede/i);
  });

  it("aceita pagamento parcial dentro do saldo", () => {
    expect(validatePayment(title(), { amount: 600 }, [payment({ amount: 400 })]).ok).toBe(true);
  });

  it("impede pagamento sem saldo", () => {
    const r = validatePayment(title(), { amount: 10 }, [payment({ amount: 1000 })]);
    expect(r.error).toMatch(/saldo/i);
  });

  it("impede pagamento em título cancelado ou estornado", () => {
    expect(validatePayment(title({ status: "cancelado" }), { amount: 10 }, []).ok).toBe(false);
    expect(validatePayment(title({ status: "estornado" }), { amount: 10 }, []).ok).toBe(false);
  });

  it("estorno deve ser integral e único", () => {
    const original = payment({ amount: 400 });
    expect(
      validatePayment(title(), { amount: 300, isReversal: true, reversesPaymentId: "p1" }, [
        original,
      ]).ok,
    ).toBe(false);
    expect(
      validatePayment(title(), { amount: 400, isReversal: true, reversesPaymentId: "p1" }, [
        original,
      ]).ok,
    ).toBe(true);
    expect(
      validatePayment(title(), { amount: 400, isReversal: true, reversesPaymentId: "p1" }, [
        original,
        payment({ id: "p2", amount: 400, is_reversal: true, reverses_payment_id: "p1" }),
      ]).error,
    ).toMatch(/já possui estorno/i);
  });

  it("não estorna um estorno", () => {
    const rev = payment({ id: "p9", amount: 100, is_reversal: true, reverses_payment_id: "p1" });
    expect(
      validatePayment(title(), { amount: 100, isReversal: true, reversesPaymentId: "p9" }, [rev])
        .error,
    ).toMatch(/estornar um estorno/i);
  });

  it("rejeita valores não positivos", () => {
    expect(validatePayment(title(), { amount: 0 }, []).ok).toBe(false);
  });
});

describe("idempotência por origem", () => {
  const rows = [
    { id: "a", source_type: "daily_rate", source_id: "d1" },
    { id: "b", source_type: "daily_rate", source_id: "d1" },
    { id: "c", source_type: null, source_id: null },
  ];

  it("detecta origem já lançada", () => {
    expect(hasSource(rows, "daily_rate", "d1")).toBe(true);
    expect(hasSource(rows, "daily_rate", "d2")).toBe(false);
  });

  it("remove duplicatas mantendo lançamentos sem origem", () => {
    expect(dedupeBySource(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("panorama realizado x previsto", () => {
  const titles = [
    title({ id: "t1", kind: "receber", total_amount: 1000, due_date: "2026-08-01" }),
    title({ id: "t2", kind: "pagar", total_amount: 400, due_date: "2026-08-15" }),
    title({ id: "t3", kind: "receber", total_amount: 900, status: "cancelado" }),
  ];
  const payments = [payment({ id: "p1", title_id: "t1", amount: 250 })];

  it("separa aberto, vencido e realizado ignorando cancelados", () => {
    const s = buildSnapshot(titles, payments, "2026-08-10");
    expect(s.aReceber).toBe(750);
    expect(s.aPagar).toBe(400);
    expect(s.vencidoReceber).toBe(750);
    expect(s.vencidoPagar).toBe(0);
    expect(s.recebido).toBe(250);
    expect(s.saldoPrevisto).toBe(350);
    expect(s.agingPagar.ate7).toBe(400);
  });

  it("projeta saldo acumulado a partir do saldo inicial", () => {
    const proj = buildProjection(titles, payments, 100, 2, "2026-08-10");
    expect(proj[0].month).toBe("2026-08");
    expect(proj[0].previstoEntrada).toBe(750);
    expect(proj[0].previstoSaida).toBe(400);
    expect(proj[0].saldoAcumulado).toBe(450);
    expect(proj).toHaveLength(2);
  });
});

describe("orçado x realizado por evento", () => {
  it("consolida receita, custo e margem", () => {
    const events = [{ id: "e1", name: "Show", total_budget: 2000 }];
    const titles = [
      title({ id: "t1", kind: "receber", event_id: "e1", total_amount: 1500 }),
      title({ id: "t2", kind: "pagar", event_id: "e1", total_amount: 500 }),
    ];
    const payments = [
      payment({ id: "p1", title_id: "t1", amount: 1500 }),
      payment({ id: "p2", title_id: "t2", amount: 500 }),
    ];
    const [row] = buildBudgetVsActual(events, titles, payments, { e1: 200 });
    expect(row.receitaRealizada).toBe(1500);
    expect(row.custoRealizado).toBe(700);
    expect(row.margem).toBe(800);
    expect(row.margemPercentual).toBeCloseTo(53.3, 1);
  });
});

describe("permissões de operação", () => {
  const canOperate = (role: string | null) => role === "admin" || role === "financeiro";

  it("permite apenas admin e financeiro", () => {
    expect(canOperate("admin")).toBe(true);
    expect(canOperate("financeiro")).toBe(true);
    expect(canOperate("funcionario")).toBe(false);
    expect(canOperate("deposito")).toBe(false);
    expect(canOperate(null)).toBe(false);
  });
});
