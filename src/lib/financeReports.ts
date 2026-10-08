/**
 * Núcleo puro dos RELATÓRIOS da Gestão Financeira.
 *
 * Regras fundamentais:
 * - Toda soma é feita em centavos (sem erro de ponto flutuante).
 * - Datas são strings YYYY-MM-DD (America/Sao_Paulo), nunca `new Date` local.
 * - Deduplicação é SEMPRE por origem (reference_type/reference_id ou source/sourceId),
 *   NUNCA por texto da descrição.
 * - `bank_transactions` é a fonte da verdade do realizado.
 */

import {
  fromCents,
  toCents,
  todaySaoPaulo,
  type FinanceInstallment,
  type FinancePayment,
  type FinanceTitle,
  netPaid,
  openBalance,
} from "@/lib/finance";
import { dateOnly, inRange, monthKey, formatMonthBR, type DateRange } from "@/lib/reports";

/* ------------------------------------------------------------------ tipos */

export type LedgerType = "income" | "expense";

/** Situação do lançamento em relação ao caixa. */
export type LedgerStatus = "realizado" | "previsto";

export type LedgerSource =
  | "bank_transactions"
  | "event_expenses"
  | "company_expenses"
  | "recurring_expense_payments"
  | "bank_card_transactions"
  | "daily_rates"
  | "worker_advances"
  | "collaborator_advances"
  | "events"
  | "finance_payments";

export interface LedgerEntry {
  /** Identificador único na lista (sintético, estável). */
  id: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  createdAt?: string | null;
  description: string;
  category: string;
  costCenter?: string | null;
  type: LedgerType;
  /** Sempre positivo — o sinal vem de `type`. */
  amount: number;
  accountId: string | null;
  accountName: string | null;
  source: LedgerSource;
  /** id da linha de origem — rastreabilidade até o lançamento. */
  sourceId: string;
  referenceType?: string | null;
  referenceId?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  status: LedgerStatus;
}

/* ------------------------------------------------------- normalização texto */

export const normalizeText = (value?: string | null): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/* --------------------------------------------------------- deduplicação */

/**
 * Chave canônica de origem. Quando o lançamento aponta para outra tabela
 * (reference_type/reference_id) essa é a identidade; senão é a própria linha.
 */
export const originKey = (entry: LedgerEntry): string => {
  if (entry.referenceType && entry.referenceId) {
    return `${normalizeText(entry.referenceType)}:${entry.referenceId}`;
  }
  return `${entry.source}:${entry.sourceId}`;
};

/**
 * Remove duplicatas por ORIGEM (nunca por texto).
 * Prioridade: `bank_transactions` (realizado) vence qualquer lançamento derivado.
 */
export const dedupeLedger = (entries: LedgerEntry[]): LedgerEntry[] => {
  const bankOrigins = new Set<string>();
  entries.forEach((entry) => {
    if (entry.source !== "bank_transactions") return;
    bankOrigins.add(originKey(entry));
    // uma transação bancária também "cobre" a própria linha de origem
    if (entry.referenceType && entry.referenceId) {
      bankOrigins.add(`row:${entry.referenceId}`);
    }
  });

  const seen = new Set<string>();
  const result: LedgerEntry[] = [];

  entries.forEach((entry) => {
    const key = originKey(entry);
    if (entry.source !== "bank_transactions") {
      if (bankOrigins.has(key)) return;
      if (bankOrigins.has(`row:${entry.sourceId}`)) return;
    }
    const unique = `${entry.source}:${entry.sourceId}`;
    if (seen.has(unique)) return;
    seen.add(unique);
    result.push(entry);
  });

  return result;
};

/* --------------------------------------------------- transferências internas */

const TRANSFER_HINTS = ["transfer", "transf", "ted", "doc"];

export const isTransferCategory = (category?: string | null): boolean => {
  const c = normalizeText(category);
  return c === "transferencia" || c === "transferencias" || c === "transferencia entre contas";
};

const looksLikeTransfer = (entry: LedgerEntry): boolean =>
  isTransferCategory(entry.category) ||
  TRANSFER_HINTS.some((hint) => normalizeText(entry.description).includes(hint));

/**
 * Detecta transferências entre contas por PAR (mesma data + mesmo valor,
 * uma entrada e uma saída em contas diferentes). Não altera os dados.
 */
export const detectTransferIds = (entries: LedgerEntry[]): Set<string> => {
  const groups = new Map<string, { incomes: LedgerEntry[]; expenses: LedgerEntry[] }>();

  entries.forEach((entry) => {
    if (!looksLikeTransfer(entry)) return;
    const key = `${entry.date}|${toCents(entry.amount)}`;
    const group = groups.get(key) ?? { incomes: [], expenses: [] };
    (entry.type === "income" ? group.incomes : group.expenses).push(entry);
    groups.set(key, group);
  });

  const ids = new Set<string>();
  groups.forEach((group) => {
    if (!group.incomes.length || !group.expenses.length) return;
    const differentAccounts = group.incomes.some((i) =>
      group.expenses.some((e) => String(i.accountId ?? "") !== String(e.accountId ?? "")),
    );
    if (!differentAccounts) return;
    group.incomes.forEach((i) => ids.add(i.id));
    group.expenses.forEach((e) => ids.add(e.id));
  });

  // categoria explícita de transferência sempre conta
  entries.forEach((entry) => {
    if (isTransferCategory(entry.category)) ids.add(entry.id);
  });

  return ids;
};

export const withoutTransfers = (entries: LedgerEntry[]): LedgerEntry[] => {
  const ids = detectTransferIds(entries);
  return entries.filter((e) => !ids.has(e.id));
};

/* ------------------------------------------------------------------ totais */

export interface LedgerTotals {
  entradas: number;
  saidas: number;
  saldo: number;
  transferencias: number;
  count: number;
}

export const summarizeLedger = (entries: LedgerEntry[]): LedgerTotals => {
  const transferIds = detectTransferIds(entries);
  let entradas = 0;
  let saidas = 0;
  let transferencias = 0;

  entries.forEach((entry) => {
    const cents = toCents(entry.amount);
    if (transferIds.has(entry.id)) {
      transferencias += cents;
      return;
    }
    if (entry.type === "income") entradas += cents;
    else saidas += cents;
  });

  return {
    entradas: fromCents(entradas),
    saidas: fromCents(saidas),
    saldo: fromCents(entradas - saidas),
    transferencias: fromCents(transferencias),
    count: entries.length,
  };
};

export const filterLedger = (
  entries: LedgerEntry[],
  filters: {
    range?: DateRange;
    accountId?: string | null;
    type?: LedgerType | "all";
    category?: string | "all";
    eventId?: string | "all";
    status?: LedgerStatus | "all";
    includeTransfers?: boolean;
  } = {},
): LedgerEntry[] => {
  const transferIds = filters.includeTransfers ? new Set<string>() : detectTransferIds(entries);
  return entries.filter((entry) => {
    if (transferIds.has(entry.id)) return false;
    if (filters.range && !inRange(entry.date, filters.range)) return false;
    if (filters.accountId && filters.accountId !== "all" && entry.accountId !== filters.accountId)
      return false;
    if (filters.type && filters.type !== "all" && entry.type !== filters.type) return false;
    if (
      filters.category &&
      filters.category !== "all" &&
      normalizeText(entry.category) !== normalizeText(filters.category)
    )
      return false;
    if (filters.eventId && filters.eventId !== "all" && entry.eventId !== filters.eventId)
      return false;
    if (filters.status && filters.status !== "all" && entry.status !== filters.status) return false;
    return true;
  });
};

/* ------------------------------------------------------- DRE gerencial */

export type DreGroup =
  | "receita"
  | "imposto"
  | "custo_direto"
  | "administrativa"
  | "comercial"
  | "financeira"
  | "outras";

const GROUP_RULES: Array<{ group: DreGroup; terms: string[] }> = [
  { group: "imposto", terms: ["imposto", "iss", "das ", "simples nacional", "pis", "cofins", "irpj", "csll", "tributo", "darf"] },
  {
    group: "custo_direto",
    terms: [
      "diaria", "diarista", "colaborador", "equipamento", "locacao", "transporte", "frete",
      "alimentacao", "hospedagem", "combustivel", "mao de obra", "vale", "adiantamento",
      "producao", "montagem", "evento",
    ],
  },
  {
    group: "administrativa",
    terms: ["aluguel", "agua", "luz", "energia", "internet", "telefone", "escritorio", "contabil", "salario", "software", "sistema", "seguro", "limpeza"],
  },
  { group: "comercial", terms: ["marketing", "publicidade", "comissao", "anuncio", "trafego"] },
  { group: "financeira", terms: ["juros", "tarifa", "iof", "multa", "banco", "cartao"] },
];

export const classifyDreGroup = (category?: string | null, description?: string | null): DreGroup => {
  const haystack = `${normalizeText(category)} ${normalizeText(description)}`;
  for (const rule of GROUP_RULES) {
    if (rule.terms.some((t) => haystack.includes(t.trim()))) return rule.group;
  }
  return "outras";
};

export interface DreLine {
  group: DreGroup;
  label: string;
  total: number;
  count: number;
}

export interface ManagerialDre {
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  custoDireto: number;
  lucroBruto: number;
  despesasAdministrativas: number;
  despesasComerciais: number;
  despesasFinanceiras: number;
  outrasDespesas: number;
  despesasOperacionais: number;
  resultado: number;
  margemBruta: number; // %
  margemLiquida: number; // %
  linhas: DreLine[];
}

const GROUP_LABEL: Record<DreGroup, string> = {
  receita: "Receitas",
  imposto: "Impostos e deduções",
  custo_direto: "Custos diretos (eventos)",
  administrativa: "Despesas administrativas",
  comercial: "Despesas comerciais",
  financeira: "Despesas financeiras",
  outras: "Outras despesas",
};

export const dreGroupLabel = (group: DreGroup): string => GROUP_LABEL[group];

/** DRE gerencial simplificada, por regime de caixa (lançamentos realizados). */
export const buildManagerialDre = (entries: LedgerEntry[]): ManagerialDre => {
  const clean = withoutTransfers(entries);
  const buckets = new Map<DreGroup, { total: number; count: number }>();
  let receitaCents = 0;

  clean.forEach((entry) => {
    const cents = toCents(entry.amount);
    if (entry.type === "income") {
      receitaCents += cents;
      const acc = buckets.get("receita") ?? { total: 0, count: 0 };
      buckets.set("receita", { total: acc.total + cents, count: acc.count + 1 });
      return;
    }
    const group = classifyDreGroup(entry.category, entry.description);
    const acc = buckets.get(group) ?? { total: 0, count: 0 };
    buckets.set(group, { total: acc.total + cents, count: acc.count + 1 });
  });

  const get = (group: DreGroup) => buckets.get(group)?.total ?? 0;

  const impostos = get("imposto");
  const custoDireto = get("custo_direto");
  const admin = get("administrativa");
  const comercial = get("comercial");
  const financeira = get("financeira");
  const outras = get("outras");

  const receitaLiquida = receitaCents - impostos;
  const lucroBruto = receitaLiquida - custoDireto;
  const operacionais = admin + comercial + financeira + outras;
  const resultado = lucroBruto - operacionais;

  const linhas: DreLine[] = Array.from(buckets.entries())
    .map(([group, v]) => ({
      group,
      label: GROUP_LABEL[group],
      total: fromCents(v.total),
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    receitaBruta: fromCents(receitaCents),
    impostos: fromCents(impostos),
    receitaLiquida: fromCents(receitaLiquida),
    custoDireto: fromCents(custoDireto),
    lucroBruto: fromCents(lucroBruto),
    despesasAdministrativas: fromCents(admin),
    despesasComerciais: fromCents(comercial),
    despesasFinanceiras: fromCents(financeira),
    outrasDespesas: fromCents(outras),
    despesasOperacionais: fromCents(operacionais),
    resultado: fromCents(resultado),
    margemBruta: receitaLiquida === 0 ? 0 : Math.round((lucroBruto / receitaLiquida) * 1000) / 10,
    margemLiquida: receitaCents === 0 ? 0 : Math.round((resultado / receitaCents) * 1000) / 10,
    linhas,
  };
};

/* --------------------------------------------------------- fluxo de caixa */

export interface CashFlowPoint {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
}

/** Fluxo de caixa realizado agrupado por mês, com saldo acumulado. */
export const cashFlowByMonth = (
  entries: LedgerEntry[],
  range: DateRange,
  initialBalance = 0,
): CashFlowPoint[] => {
  const clean = withoutTransfers(entries).filter((e) => inRange(e.date, range));
  const keys: string[] = [];
  let cursor = range.start.slice(0, 7);
  const last = range.end.slice(0, 7);
  let guard = 0;
  while (cursor <= last && guard < 240) {
    keys.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    cursor = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    guard += 1;
  }

  const inMap = new Map(keys.map((k) => [k, 0]));
  const outMap = new Map(keys.map((k) => [k, 0]));
  clean.forEach((entry) => {
    const k = monthKey(entry.date);
    const target = entry.type === "income" ? inMap : outMap;
    if (!target.has(k)) return;
    target.set(k, (target.get(k) ?? 0) + toCents(entry.amount));
  });

  let acumulado = toCents(initialBalance);
  return keys.map((key) => {
    const i = inMap.get(key) ?? 0;
    const o = outMap.get(key) ?? 0;
    acumulado += i - o;
    return {
      key,
      label: formatMonthBR(key),
      entradas: fromCents(i),
      saidas: fromCents(o),
      saldo: fromCents(i - o),
      acumulado: fromCents(acumulado),
    };
  });
};

/* ------------------------------------------------------------------ aging */

export interface AgingRow {
  id: string;
  descricao: string;
  parte: string;
  vencimento: string;
  valorAberto: number;
  diasAtraso: number;
  faixa: string;
  kind: "receber" | "pagar";
  titleId: string;
}

const bucketOf = (days: number): string => {
  if (days <= 0) return "A vencer";
  if (days <= 15) return "1-15 dias";
  if (days <= 30) return "16-30 dias";
  if (days <= 60) return "31-60 dias";
  return "60+ dias";
};

export const AGING_BUCKETS = ["A vencer", "1-15 dias", "16-30 dias", "31-60 dias", "60+ dias"];

const daysLate = (due: string, reference: string): number =>
  Math.round(
    (Date.parse(`${reference}T00:00:00Z`) - Date.parse(`${dateOnly(due)}T00:00:00Z`)) / 86400000,
  );

/**
 * Aging por PARCELA quando existirem parcelas; senão pelo título.
 * Considera apenas saldo em aberto (total - pagamentos líquidos).
 */
export const buildAging = (
  titles: FinanceTitle[],
  installments: FinanceInstallment[],
  payments: FinancePayment[],
  reference: string = todaySaoPaulo(),
): AgingRow[] => {
  const rows: AgingRow[] = [];
  const paymentsByTitle = new Map<string, FinancePayment[]>();
  payments.forEach((p) => {
    const list = paymentsByTitle.get(p.title_id) ?? [];
    list.push(p);
    paymentsByTitle.set(p.title_id, list);
  });

  titles.forEach((title) => {
    if (title.status === "cancelado" || title.status === "estornado") return;
    const titlePayments = paymentsByTitle.get(title.id) ?? [];
    const parcels = installments.filter((i) => i.title_id === title.id && i.status !== "cancelado");
    const parte = title.kind === "receber" ? title.description : (title.supplier_name || title.description);

    if (parcels.length > 0) {
      parcels.forEach((parcel) => {
        const paid = netPaid(titlePayments.filter((p) => p.installment_id === parcel.id));
        const open = fromCents(toCents(parcel.amount) - toCents(paid));
        if (open <= 0) return;
        const late = daysLate(parcel.due_date, reference);
        rows.push({
          id: `inst-${parcel.id}`,
          descricao: `${title.description} — parcela ${parcel.number}`,
          parte,
          vencimento: dateOnly(parcel.due_date),
          valorAberto: open,
          diasAtraso: Math.max(0, late),
          faixa: bucketOf(late),
          kind: title.kind,
          titleId: title.id,
        });
      });
      return;
    }

    const open = openBalance(title.total_amount, titlePayments);
    if (open <= 0) return;
    const late = daysLate(title.due_date, reference);
    rows.push({
      id: `title-${title.id}`,
      descricao: title.description,
      parte,
      vencimento: dateOnly(title.due_date),
      valorAberto: open,
      diasAtraso: Math.max(0, late),
      faixa: bucketOf(late),
      kind: title.kind,
      titleId: title.id,
    });
  });

  return rows.sort((a, b) => b.diasAtraso - a.diasAtraso || b.valorAberto - a.valorAberto);
};

export interface AgingSummary {
  buckets: Array<{ faixa: string; total: number; count: number }>;
  total: number;
  vencido: number;
  aVencer: number;
}

export const summarizeAging = (rows: AgingRow[]): AgingSummary => {
  const map = new Map<string, { total: number; count: number }>(
    AGING_BUCKETS.map((b) => [b, { total: 0, count: 0 }]),
  );
  let total = 0;
  let vencido = 0;
  rows.forEach((row) => {
    const acc = map.get(row.faixa) ?? { total: 0, count: 0 };
    const cents = toCents(row.valorAberto);
    map.set(row.faixa, { total: acc.total + cents, count: acc.count + 1 });
    total += cents;
    if (row.diasAtraso > 0) vencido += cents;
  });
  return {
    buckets: AGING_BUCKETS.map((faixa) => ({
      faixa,
      total: fromCents(map.get(faixa)?.total ?? 0),
      count: map.get(faixa)?.count ?? 0,
    })),
    total: fromCents(total),
    vencido: fromCents(vencido),
    aVencer: fromCents(total - vencido),
  };
};

/** Índice de inadimplência = vencido em aberto / (vencido em aberto + recebido). */
export const buildDelinquency = (
  rows: AgingRow[],
  received: number,
): { vencido: number; base: number; indice: number } => {
  const vencido = rows
    .filter((r) => r.kind === "receber" && r.diasAtraso > 0)
    .reduce((sum, r) => sum + toCents(r.valorAberto), 0);
  const base = vencido + toCents(received);
  return {
    vencido: fromCents(vencido),
    base: fromCents(base),
    indice: base === 0 ? 0 : Math.round((vencido / base) * 1000) / 10,
  };
};

/* ------------------------------------------------- resultado por evento */

export interface EventResultRow {
  id: string;
  evento: string;
  data: string;
  orcado: number;
  receita: number;
  custo: number;
  margem: number;
  margemPercentual: number;
  status: string;
}

export const buildEventResults = (
  events: Array<{
    id: string;
    name: string;
    event_date?: string | null;
    total_budget?: number | null;
    status?: string | null;
  }>,
  entries: LedgerEntry[],
): EventResultRow[] => {
  const clean = withoutTransfers(entries);
  const income = new Map<string, number>();
  const cost = new Map<string, number>();

  clean.forEach((entry) => {
    if (!entry.eventId) return;
    const target = entry.type === "income" ? income : cost;
    target.set(entry.eventId, (target.get(entry.eventId) ?? 0) + toCents(entry.amount));
  });

  return events
    .map((event) => {
      const receitaCents = income.get(event.id) ?? 0;
      const custoCents = cost.get(event.id) ?? 0;
      const margemCents = receitaCents - custoCents;
      return {
        id: event.id,
        evento: event.name,
        data: dateOnly(event.event_date),
        orcado: Number(event.total_budget ?? 0),
        receita: fromCents(receitaCents),
        custo: fromCents(custoCents),
        margem: fromCents(margemCents),
        margemPercentual:
          receitaCents === 0 ? 0 : Math.round((margemCents / receitaCents) * 1000) / 10,
        status: event.status ?? "—",
      };
    })
    .sort((a, b) => b.receita - a.receita);
};

/* ------------------------------------------------------------ conciliação */

export interface ReconciliationRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: LedgerType;
  accountName: string | null;
  origem: string;
  situacao: "conciliado" | "somente_banco" | "somente_sistema";
  sourceId: string;
}

/**
 * Conciliação: cruza `bank_transactions` com os lançamentos operacionais.
 * O casamento é por ORIGEM (reference) e, na falta dela, por data + valor exatos
 * na mesma conta — nunca por semelhança de texto.
 */
export const buildReconciliation = (entries: LedgerEntry[]): ReconciliationRow[] => {
  const bank = entries.filter((e) => e.source === "bank_transactions");
  const operational = entries.filter((e) => e.source !== "bank_transactions");

  const bankByOrigin = new Set(bank.map(originKey));
  const bankByExact = new Map<string, LedgerEntry>();
  bank.forEach((b) => {
    bankByExact.set(`${b.date}|${toCents(b.amount)}|${b.type}|${b.accountId ?? ""}`, b);
  });

  const matchedBankIds = new Set<string>();
  const rows: ReconciliationRow[] = [];

  operational.forEach((entry) => {
    const key = originKey(entry);
    const exactKey = `${entry.date}|${toCents(entry.amount)}|${entry.type}|${entry.accountId ?? ""}`;
    const byOrigin = bankByOrigin.has(key) || bankByOrigin.has(`${entry.source}:${entry.sourceId}`);
    const exact = bankByExact.get(exactKey);
    if (byOrigin || exact) {
      if (exact) matchedBankIds.add(exact.id);
      rows.push({
        id: entry.id,
        date: entry.date,
        description: entry.description,
        amount: entry.amount,
        type: entry.type,
        accountName: entry.accountName,
        origem: entry.source,
        situacao: "conciliado",
        sourceId: entry.sourceId,
      });
      return;
    }
    rows.push({
      id: entry.id,
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      accountName: entry.accountName,
      origem: entry.source,
      situacao: "somente_sistema",
      sourceId: entry.sourceId,
    });
  });

  bank.forEach((entry) => {
    if (matchedBankIds.has(entry.id)) return;
    if (entry.referenceType && entry.referenceId) return; // já rastreado à origem
    rows.push({
      id: entry.id,
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      accountName: entry.accountName,
      origem: "bank_transactions",
      situacao: "somente_banco",
      sourceId: entry.sourceId,
    });
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date));
};

/* ------------------------------------------------ previsto / comprometido */

export interface CommitmentSummary {
  previstoReceber: number;
  previstoPagar: number;
  vencidoReceber: number;
  vencidoPagar: number;
  comprometido: number;
  saldoProjetado: number;
}

export const buildCommitments = (
  aging: AgingRow[],
  saldoAtual: number,
): CommitmentSummary => {
  let receber = 0;
  let pagar = 0;
  let vencidoReceber = 0;
  let vencidoPagar = 0;

  aging.forEach((row) => {
    const cents = toCents(row.valorAberto);
    if (row.kind === "receber") {
      receber += cents;
      if (row.diasAtraso > 0) vencidoReceber += cents;
    } else {
      pagar += cents;
      if (row.diasAtraso > 0) vencidoPagar += cents;
    }
  });

  return {
    previstoReceber: fromCents(receber),
    previstoPagar: fromCents(pagar),
    vencidoReceber: fromCents(vencidoReceber),
    vencidoPagar: fromCents(vencidoPagar),
    comprometido: fromCents(pagar),
    saldoProjetado: fromCents(toCents(saldoAtual) + receber - pagar),
  };
};
