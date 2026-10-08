import { describe, it, expect } from "vitest";
import {
  buildReversalRow,
  buildTransferRows,
  canDeleteAccount,
  closedThroughFor,
  duplicateKey,
  filterStatement,
  findDuplicates,
  groupTransfers,
  isDateLocked,
  isReversed,
  isTransferTx,
  listCategories,
  openingBalanceAt,
  summarizeAccount,
  summarizeCard,
  toExportRows,
  totalBalance,
  TRANSFER_IN,
  TRANSFER_OUT,
  txStatus,
  validateAccount,
  validateCard,
  validateClosing,
  validateReversal,
  validateTransfer,
  withoutTransfers,
  withRunningBalance,
  type AccountRecord,
  type AccountTx,
  type CardRecord,
  type CardTx,
  type PeriodClosing,
} from "@/lib/accounts";

const TODAY = "2026-06-15";

const account = (over: Partial<AccountRecord> = {}): AccountRecord => ({
  id: "acc-1",
  name: "C6 BANK",
  type: "checking",
  initialBalance: 100,
  storedBalance: 0,
  isActive: true,
  ...over,
});

const tx = (over: Partial<AccountTx> = {}): AccountTx => ({
  id: "t1",
  accountId: "acc-1",
  date: "2026-06-10",
  description: "Lançamento",
  category: "Geral",
  type: "income",
  amount: 10,
  ...over,
});

/* ------------------------------------------------------------- saldos */

describe("saldos por conta", () => {
  it("soma saldo inicial + entradas - saídas em centavos", () => {
    const txs = [
      tx({ id: "a", type: "income", amount: 0.1 }),
      tx({ id: "b", type: "income", amount: 0.2 }),
      tx({ id: "c", type: "expense", amount: 0.15 }),
    ];
    const s = summarizeAccount(account({ initialBalance: 0 }), txs, TODAY);
    expect(s.current).toBe(0.15);
    expect(s.income).toBe(0.3);
    expect(s.expense).toBe(0.15);
  });

  it("inclui o saldo inicial e aponta divergência com o saldo armazenado", () => {
    const txs = [tx({ id: "a", type: "income", amount: 50 })];
    const s = summarizeAccount(account({ initialBalance: 100, storedBalance: 50 }), txs, TODAY);
    expect(s.current).toBe(150);
    expect(s.stored).toBe(50);
    expect(s.divergence).toBe(100);
  });

  it("preserva saldo negativo", () => {
    const s = summarizeAccount(
      account({ initialBalance: 0, storedBalance: -415.99 }),
      [tx({ id: "a", type: "expense", amount: 415.99 })],
      TODAY,
    );
    expect(s.current).toBe(-415.99);
    expect(s.divergence).toBe(0);
  });

  it("separa disponível (até hoje) de previsto (futuro)", () => {
    const txs = [
      tx({ id: "a", type: "income", amount: 100, date: "2026-06-01" }),
      tx({ id: "b", type: "expense", amount: 40, date: "2026-06-30" }),
    ];
    const s = summarizeAccount(account({ initialBalance: 0 }), txs, TODAY);
    expect(s.current).toBe(60);
    expect(s.available).toBe(100);
    expect(s.scheduled).toBe(-40);
  });

  it("soma o total de várias contas", () => {
    const a = summarizeAccount(account({ id: "a", initialBalance: 10 }), [], TODAY);
    const b = summarizeAccount(account({ id: "b", initialBalance: 5.55 }), [], TODAY);
    expect(totalBalance([a, b])).toBe(15.55);
  });

  it("calcula saldo acumulado do extrato em ordem cronológica", () => {
    const rows = withRunningBalance(
      [
        tx({ id: "b", date: "2026-06-02", type: "expense", amount: 30 }),
        tx({ id: "a", date: "2026-06-01", type: "income", amount: 100 }),
      ],
      50,
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows[0].runningBalance).toBe(150);
    expect(rows[1].runningBalance).toBe(120);
  });

  it("calcula saldo de abertura em uma data (exclusive)", () => {
    const txs = [
      tx({ id: "a", date: "2026-05-31", type: "income", amount: 20 }),
      tx({ id: "b", date: "2026-06-01", type: "income", amount: 5 }),
    ];
    expect(openingBalanceAt(account({ initialBalance: 100 }), txs, "2026-06-01")).toBe(120);
  });
});

/* ------------------------------------------------------ transferências */

describe("transferências", () => {
  const accounts = [account({ id: "a", name: "A" }), account({ id: "b", name: "B" })];
  const balances = new Map([
    ["a", summarizeAccount(account({ id: "a", initialBalance: 500 }), [], TODAY)],
    ["b", summarizeAccount(account({ id: "b", initialBalance: 0 }), [], TODAY)],
  ]);

  it("gera duas pernas com o mesmo grupo e categoria de transferência", () => {
    const [out, into] = buildTransferRows(
      { fromAccountId: "a", toAccountId: "b", amount: 100, date: TODAY, description: "ajuste" },
      "A",
      "B",
      "grp-1",
    );
    expect(out.transaction_type).toBe("expense");
    expect(into.transaction_type).toBe("income");
    expect(out.reference_type).toBe(TRANSFER_OUT);
    expect(into.reference_type).toBe(TRANSFER_IN);
    expect(out.reference_id).toBe(into.reference_id);
    expect(out.amount).toBe(into.amount);
  });

  it("não conta transferência como receita nem despesa", () => {
    const txs = [
      tx({ id: "o", accountId: "a", type: "expense", amount: 100, referenceType: TRANSFER_OUT, referenceId: "g" }),
      tx({ id: "i", accountId: "b", type: "income", amount: 100, referenceType: TRANSFER_IN, referenceId: "g" }),
      tx({ id: "r", accountId: "a", type: "income", amount: 20 }),
    ];
    expect(withoutTransfers(txs)).toHaveLength(1);
    const sa = summarizeAccount(account({ id: "a", initialBalance: 0 }), txs, TODAY);
    expect(sa.income).toBe(20);
    expect(sa.expense).toBe(0);
    expect(sa.transferOut).toBe(100);
    expect(sa.current).toBe(-80);
    const sb = summarizeAccount(account({ id: "b", initialBalance: 0 }), txs, TODAY);
    expect(sb.income).toBe(0);
    expect(sb.current).toBe(100);
  });

  it("agrupa pares e marca pares incompletos", () => {
    const pairs = groupTransfers([
      tx({ id: "o", type: "expense", referenceType: TRANSFER_OUT, referenceId: "g1", amount: 10 }),
      tx({ id: "i", type: "income", referenceType: TRANSFER_IN, referenceId: "g1", amount: 10 }),
      tx({ id: "x", type: "expense", referenceType: TRANSFER_OUT, referenceId: "g2", amount: 5 }),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs.find((p) => p.groupId === "g1")?.incomplete).toBe(false);
    expect(pairs.find((p) => p.groupId === "g2")?.incomplete).toBe(true);
  });

  it("valida contas iguais, valor e conta inativa", () => {
    expect(
      validateTransfer({ fromAccountId: "a", toAccountId: "a", amount: 10, date: TODAY }, accounts, balances).errors,
    ).toContain("Origem e destino devem ser contas diferentes.");
    expect(
      validateTransfer({ fromAccountId: "a", toAccountId: "b", amount: 0, date: TODAY }, accounts, balances).ok,
    ).toBe(false);
    const inativa = [account({ id: "a", name: "A", isActive: false }), account({ id: "b", name: "B" })];
    expect(
      validateTransfer({ fromAccountId: "a", toAccountId: "b", amount: 10, date: TODAY }, inativa, balances).errors,
    ).toContain("A conta de origem está inativa.");
  });

  it("avisa (sem bloquear) quando o saldo fica negativo", () => {
    const r = validateTransfer(
      { fromAccountId: "a", toAccountId: "b", amount: 900, date: TODAY },
      accounts,
      balances,
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/negativo/);
  });

  it("bloqueia transferência em período fechado", () => {
    const r = validateTransfer(
      { fromAccountId: "a", toAccountId: "b", amount: 10, date: "2026-01-10" },
      accounts,
      balances,
      (id) => (id === "a" ? "2026-01-31" : null),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Período fechado/);
  });
});

/* ------------------------------------------------------------ estornos */

describe("estornos", () => {
  it("cria contrapartida de sinal oposto rastreada ao original", () => {
    const original = tx({ id: "orig", type: "expense", amount: 250, description: "Pagamento" });
    const row = buildReversalRow(original, TODAY, "erro de digitação");
    expect(row.transaction_type).toBe("income");
    expect(row.amount).toBe(250);
    expect(row.reference_type).toBe("bank_transaction_reversal");
    expect(row.reference_id).toBe("orig");
    expect(row.description).toMatch(/^Estorno/);
  });

  it("impede estorno duplicado e estorno de perna de transferência", () => {
    const original = tx({ id: "orig", type: "expense", amount: 100 });
    const all = [
      original,
      tx({ id: "rev", type: "income", amount: 100, referenceType: "bank_transaction_reversal", referenceId: "orig" }),
    ];
    expect(isReversed(original, all)).toBe(true);
    expect(validateReversal(original, all).ok).toBe(false);

    const leg = tx({ id: "leg", referenceType: TRANSFER_OUT, referenceId: "g" });
    expect(validateReversal(leg, [leg]).errors.join(" ")).toMatch(/perna/);
  });

  it("bloqueia estorno em período fechado", () => {
    const t = tx({ id: "x", date: "2026-01-05" });
    expect(validateReversal(t, [t], "2026-01-31").ok).toBe(false);
  });

  it("estorno zera o efeito no saldo", () => {
    const original = tx({ id: "orig", type: "expense", amount: 100 });
    const reversal = tx({
      id: "rev",
      type: "income",
      amount: 100,
      referenceType: "bank_transaction_reversal",
      referenceId: "orig",
    });
    const s = summarizeAccount(account({ initialBalance: 0 }), [original, reversal], TODAY);
    expect(s.current).toBe(0);
  });
});

/* -------------------------------------------------------- conciliação */

describe("conciliação", () => {
  it("marca como conciliado quando há origem rastreada", () => {
    expect(txStatus(tx({ referenceType: "finance_payment", referenceId: "p1" }), new Set(), TODAY)).toBe(
      "conciliado",
    );
  });

  it("marca lançamento avulso como pendente até conciliação manual", () => {
    const t = tx({ id: "manual" });
    expect(txStatus(t, new Set(), TODAY)).toBe("pendente");
    expect(txStatus(t, new Set(["manual"]), TODAY)).toBe("conciliado");
  });

  it("classifica datas futuras como futuro", () => {
    expect(txStatus(tx({ date: "2026-12-01" }), new Set(), TODAY)).toBe("futuro");
  });
});

/* --------------------------------------------------------- fechamento */

describe("fechamento de período", () => {
  const closings: PeriodClosing[] = [
    { id: "1", accountId: "acc-1", closedThrough: "2026-03-31", closingBalance: 10 },
    { id: "2", accountId: "acc-1", closedThrough: "2026-04-30", closingBalance: 20 },
  ];

  it("usa o fechamento mais recente da conta", () => {
    expect(closedThroughFor(closings, "acc-1")).toBe("2026-04-30");
    expect(closedThroughFor(closings, "outra")).toBeNull();
  });

  it("bloqueia datas dentro do período fechado", () => {
    expect(isDateLocked(closings, "acc-1", "2026-04-30")).toBe(true);
    expect(isDateLocked(closings, "acc-1", "2026-05-01")).toBe(false);
  });

  it("não permite fechar período futuro nem reabrir/duplicar", () => {
    expect(validateClosing("acc-1", "2026-12-31", closings, TODAY).ok).toBe(false);
    expect(validateClosing("acc-1", "2026-04-15", closings, TODAY).ok).toBe(false);
    expect(validateClosing("acc-1", "2026-05-31", closings, TODAY).ok).toBe(true);
  });
});

/* -------------------------------------------------------- duplicidade */

describe("duplicidade", () => {
  it("detecta mesmo conta+data+tipo+valor+descrição", () => {
    const existing = [tx({ id: "a", description: "PIX  Cliente", amount: 100 })];
    const dups = findDuplicates(existing, {
      accountId: "acc-1",
      date: "2026-06-10",
      type: "income",
      amount: 100,
      description: "pix cliente",
    });
    expect(dups).toHaveLength(0); // espaços diferentes não colidem
    expect(
      findDuplicates(existing, {
        accountId: "acc-1",
        date: "2026-06-10",
        type: "income",
        amount: 100,
        description: "PIX  Cliente",
      }),
    ).toHaveLength(1);
  });

  it("não considera duplicidade entre contas diferentes", () => {
    const key1 = duplicateKey({ accountId: "a", date: "2026-06-10", type: "income", amount: 10, description: "x" });
    const key2 = duplicateKey({ accountId: "b", date: "2026-06-10", type: "income", amount: 10, description: "x" });
    expect(key1).not.toBe(key2);
  });
});

/* ------------------------------------------------------------ filtros */

describe("filtros do extrato", () => {
  const txs = [
    tx({ id: "1", date: "2026-06-01", type: "income", amount: 100, category: "Eventos" }),
    tx({ id: "2", date: "2026-06-20", type: "expense", amount: 50, category: "Equipe", description: "Diária João" }),
    tx({ id: "3", date: "2026-07-05", type: "expense", amount: 20, category: "Eventos" }),
    tx({ id: "4", date: "2026-06-10", type: "expense", amount: 30, referenceType: TRANSFER_OUT, referenceId: "g" }),
  ];
  const range = { start: "2026-06-01", end: "2026-06-30" };

  it("filtra por período", () => {
    expect(filterStatement(txs, { range }).map((t) => t.id)).toEqual(["1", "2", "4"]);
  });

  it("filtra por tipo e categoria", () => {
    expect(filterStatement(txs, { range, type: "expense" }).map((t) => t.id)).toEqual(["2", "4"]);
    expect(filterStatement(txs, { range, categories: ["Eventos"] }).map((t) => t.id)).toEqual(["1"]);
  });

  it("busca ignorando acento e caixa", () => {
    expect(filterStatement(txs, { range, search: "diaria joao" }).map((t) => t.id)).toEqual(["2"]);
  });

  it("filtra por status", () => {
    const conciliados = filterStatement(txs, { range, status: "conciliado" }, new Set(), TODAY);
    expect(conciliados.map((t) => t.id)).toEqual(["4"]);
  });

  it("pode excluir transferências", () => {
    expect(filterStatement(txs, { range, includeTransfers: false }).map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("lista categorias ordenadas", () => {
    expect(listCategories(txs)).toEqual(["Equipe", "Eventos", "Geral"]);
  });
});

/* ------------------------------------------------- contas e cartões */

describe("contas e cartões", () => {
  const accounts = [account({ id: "a", name: "C6 BANK" })];

  it("valida nome duplicado e tamanho", () => {
    expect(validateAccount({ name: "c6 bank", type: "checking", initialBalance: 0 }, accounts).ok).toBe(false);
    expect(validateAccount({ name: "X", type: "checking", initialBalance: 0 }, accounts).ok).toBe(false);
    expect(validateAccount({ name: "Itaú", type: "checking", initialBalance: 0 }, accounts).ok).toBe(true);
  });

  it("permite editar a própria conta sem colidir com o nome", () => {
    expect(validateAccount({ name: "C6 BANK", type: "cash", initialBalance: 5 }, accounts, "a").ok).toBe(true);
  });

  it("impede exclusão de conta com histórico", () => {
    expect(canDeleteAccount("acc-1", [tx()])).toBe(false);
    expect(canDeleteAccount("acc-1", [])).toBe(true);
  });

  it("valida cartão por final e duplicidade", () => {
    const cards: CardRecord[] = [
      { id: "c1", name: "Principal", cardNumber: "****1234", cardType: "credit", bank: "C6", limitAmount: 1000, isActive: true },
    ];
    expect(validateCard({ name: "Principal", cardNumber: "1234", limitAmount: 10 }, cards).ok).toBe(false);
    expect(validateCard({ name: "Reserva", cardNumber: "12", limitAmount: 10 }, cards).ok).toBe(false);
    expect(validateCard({ name: "Reserva", cardNumber: "9999", limitAmount: 10 }, cards).ok).toBe(true);
  });

  it("resume uso do cartão com limite disponível", () => {
    const card: CardRecord = {
      id: "c1", name: "Principal", cardNumber: "****1234", cardType: "credit", bank: "C6", limitAmount: 1000, isActive: true,
    };
    const txs: CardTx[] = [
      { id: "1", cardId: "c1", date: "2026-06-01", description: "Compra", category: null, type: "expense", amount: 300.5 },
      { id: "2", cardId: "c1", date: "2026-06-05", description: "Pagamento", category: null, type: "income", amount: 100 },
    ];
    const usage = summarizeCard(card, txs);
    expect(usage.spent).toBe(300.5);
    expect(usage.balance).toBe(200.5);
    expect(usage.available).toBe(799.5);
    expect(usage.usagePercent).toBe(20.1);
  });
});

/* --------------------------------------------------------- exportação */

describe("exportação", () => {
  it("gera linhas com valor assinado, status e origem", () => {
    const rows = toExportRows(
      withRunningBalance([tx({ id: "1", type: "expense", amount: 25, referenceType: "finance_payment", referenceId: "p" })], 0),
      () => "C6 BANK",
      new Set(),
      TODAY,
    );
    expect(rows[0]).toMatchObject({
      data: "2026-06-10",
      conta: "C6 BANK",
      tipo: "Saída",
      status: "Conciliado",
      valor: -25,
      origem: "finance_payment:p",
    });
  });

  it("mantém datas YYYY-MM-DD sem deslocamento de fuso", () => {
    const rows = toExportRows(withRunningBalance([tx({ date: "2026-01-01T03:00:00Z" as string })], 0), () => "X");
    expect(rows[0].data).toBe("2026-01-01");
  });
});

/* -------------------------------------------------------- transferência util */

describe("identificação de transferências", () => {
  it("reconhece as duas pernas", () => {
    expect(isTransferTx(tx({ referenceType: TRANSFER_OUT }))).toBe(true);
    expect(isTransferTx(tx({ referenceType: TRANSFER_IN }))).toBe(true);
    expect(isTransferTx(tx({ referenceType: "finance_payment" }))).toBe(false);
  });
});
