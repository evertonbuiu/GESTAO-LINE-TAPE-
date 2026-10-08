/**
 * Núcleo puro do módulo Gestão Financeira (títulos, parcelas, pagamentos).
 * Regras determinísticas, sem I/O — usadas pela UI e cobertas por testes.
 *
 * Dinheiro é sempre tratado em centavos (inteiros) para evitar erro de ponto flutuante.
 * Datas usam o calendário local de São Paulo no formato YYYY-MM-DD (sem deslocamento de fuso).
 */

export type TitleKind = "receber" | "pagar";
export type TitleStatus =
  | "rascunho"
  | "pendente"
  | "aprovado"
  | "pago"
  | "cancelado"
  | "estornado";
export type InstallmentStatus = "pendente" | "parcial" | "pago" | "cancelado";

export interface FinanceTitle {
  id: string;
  kind: TitleKind;
  status: TitleStatus;
  description: string;
  total_amount: number;
  due_date: string;
  issue_date?: string | null;
  client_id?: string | null;
  event_id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;
  supplier_name?: string | null;
  category?: string | null;
  cost_center?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  notes?: string | null;
}

export interface FinanceInstallment {
  id: string;
  title_id: string;
  number: number;
  due_date: string;
  amount: number;
  status: InstallmentStatus;
}

export interface FinancePayment {
  id: string;
  title_id: string;
  installment_id?: string | null;
  amount: number;
  paid_at: string;
  method?: string | null;
  bank_account_id?: string | null;
  discount_amount?: number | null;
  interest_amount?: number | null;
  fine_amount?: number | null;
  is_reversal: boolean;
  reverses_payment_id?: string | null;
}

/* ---------------------------------------------------------------- dinheiro */

export const toCents = (value: number): number => Math.round(value * 100);
export const fromCents = (cents: number): number => cents / 100;

/** Soma segura de valores monetários (sem erro de ponto flutuante). */
export const sumMoney = (values: number[]): number =>
  fromCents(values.reduce((acc, v) => acc + toCents(v), 0));

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

/* ------------------------------------------------------------------ datas */

const SAO_PAULO = "America/Sao_Paulo";

/** Data de hoje em São Paulo no formato YYYY-MM-DD. */
export const todaySaoPaulo = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** Formata YYYY-MM-DD para DD/MM/AAAA sem criar Date (evita deslocamento). */
export const formatDateBR = (iso?: string | null): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};

/** Soma meses preservando o dia (ajusta para o último dia quando necessário). */
export const addMonths = (iso: string, months: number): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const daysUntil = (iso: string, reference: string = todaySaoPaulo()): number =>
  Math.round(
    (Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${reference}T00:00:00Z`)) / 86400000,
  );

/* ------------------------------------------------------------- parcelamento */

/**
 * Divide um total em N parcelas sem perder centavos:
 * a diferença de arredondamento vai para a última parcela.
 */
export const buildInstallments = (
  total: number,
  count: number,
  firstDueDate: string,
): Array<{ number: number; amount: number; due_date: string }> => {
  if (count < 1) throw new Error("Número de parcelas deve ser maior que zero.");
  if (total <= 0) throw new Error("Valor total deve ser maior que zero.");

  const totalCents = toCents(total);
  const base = Math.floor(totalCents / count);
  const rest = totalCents - base * count;

  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    amount: fromCents(i === count - 1 ? base + rest : base),
    due_date: addMonths(firstDueDate, i),
  }));
};

/* ------------------------------------------------------------------ saldos */

/** Total efetivamente liquidado (pagamentos menos estornos). */
export const netPaid = (payments: FinancePayment[]): number =>
  fromCents(
    payments.reduce((acc, p) => acc + (p.is_reversal ? -toCents(p.amount) : toCents(p.amount)), 0),
  );

export const openBalance = (total: number, payments: FinancePayment[]): number =>
  fromCents(Math.max(0, toCents(total) - toCents(netPaid(payments))));

export const paymentsOfInstallment = (
  payments: FinancePayment[],
  installmentId: string,
): FinancePayment[] => payments.filter((p) => p.installment_id === installmentId);

/** Situação derivada de uma parcela conforme o que já foi liquidado. */
export const derivedInstallmentStatus = (
  installment: FinanceInstallment,
  payments: FinancePayment[],
): InstallmentStatus => {
  if (installment.status === "cancelado") return "cancelado";
  const paid = toCents(netPaid(paymentsOfInstallment(payments, installment.id)));
  if (paid <= 0) return "pendente";
  if (paid >= toCents(installment.amount)) return "pago";
  return "parcial";
};

/** Situação derivada do título: só vira "pago" quando o saldo zera. */
export const derivedTitleStatus = (
  title: FinanceTitle,
  payments: FinancePayment[],
): TitleStatus => {
  if (title.status === "cancelado" || title.status === "estornado") return title.status;
  const paid = toCents(netPaid(payments));
  if (paid >= toCents(title.total_amount)) return "pago";
  if (title.status === "pago") return "pendente";
  return title.status;
};

/* -------------------------------------------------------------- transições */

const TITLE_TRANSITIONS: Record<TitleStatus, TitleStatus[]> = {
  rascunho: ["pendente", "cancelado"],
  pendente: ["aprovado", "pago", "cancelado"],
  aprovado: ["pago", "cancelado"],
  pago: ["estornado"],
  cancelado: [],
  estornado: [],
};

const INSTALLMENT_TRANSITIONS: Record<InstallmentStatus, InstallmentStatus[]> = {
  pendente: ["parcial", "pago", "cancelado"],
  parcial: ["pago", "cancelado"],
  pago: ["parcial", "pendente"],
  cancelado: [],
};

export const canTransitionTitle = (from: TitleStatus, to: TitleStatus): boolean =>
  from === to || TITLE_TRANSITIONS[from].includes(to);

export const canTransitionInstallment = (
  from: InstallmentStatus,
  to: InstallmentStatus,
): boolean => from === to || INSTALLMENT_TRANSITIONS[from].includes(to);

/** Um título pago/estornado/cancelado não aceita alteração de dados materiais. */
export const isTitleMateriallyLocked = (status: TitleStatus): boolean =>
  status === "pago" || status === "estornado" || status === "cancelado";

/* -------------------------------------------------------------- validações */

export interface PaymentAttempt {
  amount: number;
  isReversal?: boolean;
  reversesPaymentId?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Espelha as travas do banco para dar feedback imediato na interface. */
export const validatePayment = (
  title: FinanceTitle,
  attempt: PaymentAttempt,
  existingPayments: FinancePayment[],
  installment?: FinanceInstallment | null,
): ValidationResult => {
  if (!(attempt.amount > 0)) return { ok: false, error: "Informe um valor maior que zero." };

  if (attempt.isReversal) {
    const original = existingPayments.find((p) => p.id === attempt.reversesPaymentId);
    if (!original) return { ok: false, error: "Pagamento de origem não encontrado." };
    if (original.is_reversal) return { ok: false, error: "Não é possível estornar um estorno." };
    if (existingPayments.some((p) => p.reverses_payment_id === original.id))
      return { ok: false, error: "Este pagamento já possui estorno." };
    if (toCents(original.amount) !== toCents(attempt.amount))
      return { ok: false, error: "O estorno deve ser pelo valor integral do pagamento." };
    return { ok: true };
  }

  if (title.status === "cancelado" || title.status === "estornado")
    return { ok: false, error: `Título ${title.status} não aceita pagamentos.` };

  if (installment && installment.status === "cancelado")
    return { ok: false, error: "Parcela cancelada não aceita pagamentos." };

  const scope = installment
    ? paymentsOfInstallment(existingPayments, installment.id)
    : existingPayments;
  const base = installment ? installment.amount : title.total_amount;
  const remaining = toCents(base) - toCents(netPaid(scope));

  if (remaining <= 0) return { ok: false, error: "Não há saldo em aberto." };
  if (toCents(attempt.amount) > remaining)
    return {
      ok: false,
      error: `Pagamento excede o saldo em aberto (${formatBRL(fromCents(remaining))}).`,
    };

  return { ok: true };
};

/* ------------------------------------------------------------ idempotência */

/** Chave estável de origem: impede lançar duas vezes a mesma diária/vale/contrato. */
export const sourceKey = (sourceType?: string | null, sourceId?: string | null): string | null =>
  sourceType && sourceId ? `${sourceType}:${sourceId}` : null;

export const hasSource = (
  titles: Array<Pick<FinanceTitle, "source_type" | "source_id">>,
  sourceType: string,
  sourceId: string,
): boolean =>
  titles.some((t) => sourceKey(t.source_type, t.source_id) === `${sourceType}:${sourceId}`);

/** Remove duplicatas de origem mantendo o primeiro registro visto. */
export const dedupeBySource = <T extends { source_type?: string | null; source_id?: string | null; id: string }>(
  rows: T[],
): T[] => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = sourceKey(r.source_type, r.source_id);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* --------------------------------------------------------------- dashboard */

export interface AgingBuckets {
  vencido: number;
  hoje: number;
  ate7: number;
  ate30: number;
  acima30: number;
}

export interface FinanceSnapshot {
  aReceber: number;
  aPagar: number;
  vencidoReceber: number;
  vencidoPagar: number;
  recebido: number;
  pago: number;
  saldoPrevisto: number;
  agingReceber: AgingBuckets;
  agingPagar: AgingBuckets;
}

const emptyAging = (): AgingBuckets => ({ vencido: 0, hoje: 0, ate7: 0, ate30: 0, acima30: 0 });

const bucketOf = (dueDate: string, reference: string): keyof AgingBuckets => {
  const d = daysUntil(dueDate, reference);
  if (d < 0) return "vencido";
  if (d === 0) return "hoje";
  if (d <= 7) return "ate7";
  if (d <= 30) return "ate30";
  return "acima30";
};

/**
 * Consolida realizado (pagamentos efetivos) x previsto (saldo em aberto).
 * Títulos cancelados e estornados nunca entram no previsto.
 */
export const buildSnapshot = (
  titles: FinanceTitle[],
  payments: FinancePayment[],
  reference: string = todaySaoPaulo(),
): FinanceSnapshot => {
  const snapshot: FinanceSnapshot = {
    aReceber: 0,
    aPagar: 0,
    vencidoReceber: 0,
    vencidoPagar: 0,
    recebido: 0,
    pago: 0,
    saldoPrevisto: 0,
    agingReceber: emptyAging(),
    agingPagar: emptyAging(),
  };

  const byTitle = new Map<string, FinancePayment[]>();
  payments.forEach((p) => {
    const list = byTitle.get(p.title_id) ?? [];
    list.push(p);
    byTitle.set(p.title_id, list);
  });

  let aReceberCents = 0;
  let aPagarCents = 0;
  let recebidoCents = 0;
  let pagoCents = 0;

  titles.forEach((t) => {
    const tp = byTitle.get(t.id) ?? [];
    const settled = toCents(netPaid(tp));
    if (t.kind === "receber") recebidoCents += settled;
    else pagoCents += settled;

    if (t.status === "cancelado" || t.status === "estornado" || t.status === "rascunho") return;

    const open = Math.max(0, toCents(t.total_amount) - settled);
    if (open === 0) return;

    const bucket = bucketOf(t.due_date, reference);
    if (t.kind === "receber") {
      aReceberCents += open;
      snapshot.agingReceber[bucket] = sumMoney([snapshot.agingReceber[bucket], fromCents(open)]);
      if (bucket === "vencido")
        snapshot.vencidoReceber = sumMoney([snapshot.vencidoReceber, fromCents(open)]);
    } else {
      aPagarCents += open;
      snapshot.agingPagar[bucket] = sumMoney([snapshot.agingPagar[bucket], fromCents(open)]);
      if (bucket === "vencido")
        snapshot.vencidoPagar = sumMoney([snapshot.vencidoPagar, fromCents(open)]);
    }
  });

  snapshot.aReceber = fromCents(aReceberCents);
  snapshot.aPagar = fromCents(aPagarCents);
  snapshot.recebido = fromCents(recebidoCents);
  snapshot.pago = fromCents(pagoCents);
  snapshot.saldoPrevisto = fromCents(aReceberCents - aPagarCents);
  return snapshot;
};

export interface ProjectionPoint {
  month: string; // YYYY-MM
  previstoEntrada: number;
  previstoSaida: number;
  saldoAcumulado: number;
}

/** Projeção mensal do saldo em aberto a partir de um saldo inicial informado. */
export const buildProjection = (
  titles: FinanceTitle[],
  payments: FinancePayment[],
  openingBalance: number,
  months = 6,
  reference: string = todaySaoPaulo(),
): ProjectionPoint[] => {
  const paidByTitle = new Map<string, number>();
  payments.forEach((p) =>
    paidByTitle.set(
      p.title_id,
      (paidByTitle.get(p.title_id) ?? 0) + (p.is_reversal ? -toCents(p.amount) : toCents(p.amount)),
    ),
  );

  const start = reference.slice(0, 7);
  const keys: string[] = [];
  for (let i = 0; i < months; i += 1) keys.push(addMonths(`${start}-01`, i).slice(0, 7));

  const entrada = new Map<string, number>(keys.map((k) => [k, 0]));
  const saida = new Map<string, number>(keys.map((k) => [k, 0]));

  titles.forEach((t) => {
    if (t.status === "cancelado" || t.status === "estornado" || t.status === "rascunho") return;
    const open = toCents(t.total_amount) - (paidByTitle.get(t.id) ?? 0);
    if (open <= 0) return;
    // Vencidos entram no primeiro mês da projeção.
    const monthKey = t.due_date.slice(0, 7) < start ? start : t.due_date.slice(0, 7);
    const target = t.kind === "receber" ? entrada : saida;
    if (!target.has(monthKey)) return;
    target.set(monthKey, (target.get(monthKey) ?? 0) + open);
  });

  let acc = toCents(openingBalance);
  return keys.map((month) => {
    const inCents = entrada.get(month) ?? 0;
    const outCents = saida.get(month) ?? 0;
    acc += inCents - outCents;
    return {
      month,
      previstoEntrada: fromCents(inCents),
      previstoSaida: fromCents(outCents),
      saldoAcumulado: fromCents(acc),
    };
  });
};

/* ------------------------------------------------- orçado x realizado (evento) */

export interface EventBudgetActual {
  eventId: string;
  eventName: string;
  orcado: number;
  receitaRealizada: number;
  custoRealizado: number;
  margem: number;
  margemPercentual: number;
}

export const buildBudgetVsActual = (
  events: Array<{ id: string; name: string; total_budget?: number | null }>,
  titles: FinanceTitle[],
  payments: FinancePayment[],
  extraCostsByEvent: Record<string, number> = {},
): EventBudgetActual[] => {
  const paidByTitle = new Map<string, number>();
  payments.forEach((p) =>
    paidByTitle.set(
      p.title_id,
      (paidByTitle.get(p.title_id) ?? 0) + (p.is_reversal ? -toCents(p.amount) : toCents(p.amount)),
    ),
  );

  return events.map((ev) => {
    let receita = 0;
    let custo = 0;
    titles
      .filter((t) => t.event_id === ev.id)
      .forEach((t) => {
        const settled = paidByTitle.get(t.id) ?? 0;
        if (t.kind === "receber") receita += settled;
        else custo += settled;
      });

    custo += toCents(extraCostsByEvent[ev.id] ?? 0);
    const orcado = toCents(ev.total_budget ?? 0);
    const margem = receita - custo;

    return {
      eventId: ev.id,
      eventName: ev.name,
      orcado: fromCents(orcado),
      receitaRealizada: fromCents(receita),
      custoRealizado: fromCents(custo),
      margem: fromCents(margem),
      margemPercentual: receita > 0 ? Math.round((margem / receita) * 1000) / 10 : 0,
    };
  });
};
