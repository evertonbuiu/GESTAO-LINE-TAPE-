/**
 * Núcleo puro da área CONTAS (Gestão Financeira).
 *
 * Regras:
 * - Toda soma monetária é feita em centavos (sem erro de ponto flutuante).
 * - Datas são strings YYYY-MM-DD no fuso America/Sao_Paulo — nunca `new Date()` local.
 * - `bank_transactions` é a fonte da verdade do saldo realizado.
 * - Saldo reconciliado = saldo inicial da conta + entradas - saídas.
 * - Transferências entre contas NÃO são receita nem despesa: são pares rastreados
 *   por `reference_type` (account_transfer_out / account_transfer_in) + `reference_id`.
 * - Nada aqui apaga histórico: inativação é sempre preferida à exclusão.
 */

import { fromCents, toCents, todaySaoPaulo } from "@/lib/finance";
import { dateOnly, inRange, type DateRange } from "@/lib/reports";

/* ------------------------------------------------------------------ tipos */

export type AccountType = "checking" | "savings" | "cash";
export type TxType = "income" | "expense";

/** Situação do lançamento no extrato. */
export type TxStatus = "conciliado" | "pendente" | "futuro";

export interface AccountRecord {
  id: string;
  name: string;
  type: AccountType;
  bankName?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  initialBalance: number;
  /** Saldo persistido em bank_accounts (mantido por trigger). */
  storedBalance: number;
  isActive: boolean;
  createdAt?: string | null;
}

export interface AccountTx {
  id: string;
  accountId: string | null;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm:ss quando informado pelo banco
  description: string;
  category: string | null;
  type: TxType;
  /** Sempre positivo — o sinal vem de `type`. */
  amount: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
  createdAt?: string | null;
}

export interface CardRecord {
  id: string;
  name: string;
  cardNumber: string;
  cardType: "credit" | "debit";
  bank: string;
  limitAmount: number | null;
  isActive: boolean;
}

export interface CardTx {
  id: string;
  cardId: string;
  date: string;
  description: string;
  category: string | null;
  type: TxType;
  amount: number;
}

/* ------------------------------------------------------ transferências */

export const TRANSFER_OUT = "account_transfer_out";
export const TRANSFER_IN = "account_transfer_in";
export const TRANSFER_CATEGORY = "Transferência entre contas";

export const isTransferTx = (tx: AccountTx): boolean =>
  tx.referenceType === TRANSFER_OUT || tx.referenceType === TRANSFER_IN;

/** Remove transferências (fluxo interno) de uma lista para fins de receita/despesa. */
export const withoutTransfers = (txs: AccountTx[]): AccountTx[] => txs.filter((t) => !isTransferTx(t));

export interface TransferPair {
  groupId: string;
  out?: AccountTx;
  in?: AccountTx;
  amount: number;
  date: string;
  /** Par incompleto (só uma perna encontrada) — precisa de atenção. */
  incomplete: boolean;
}

export const groupTransfers = (txs: AccountTx[]): TransferPair[] => {
  const map = new Map<string, TransferPair>();
  txs.filter(isTransferTx).forEach((tx) => {
    const groupId = tx.referenceId ?? tx.id;
    const current =
      map.get(groupId) ??
      ({ groupId, amount: tx.amount, date: tx.date, incomplete: true } as TransferPair);
    if (tx.referenceType === TRANSFER_OUT) current.out = tx;
    else current.in = tx;
    current.amount = tx.amount;
    current.date = tx.date;
    current.incomplete = !(current.out && current.in);
    map.set(groupId, current);
  });
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
};

/* ------------------------------------------------------------- saldos */

export interface AccountBalanceSummary {
  accountId: string;
  /** Saldo inicial cadastrado. */
  initial: number;
  /** Entradas (exclui transferências recebidas). */
  income: number;
  /** Saídas (exclui transferências enviadas). */
  expense: number;
  /** Transferências recebidas. */
  transferIn: number;
  /** Transferências enviadas. */
  transferOut: number;
  /** Saldo calculado com TODOS os lançamentos (inclusive futuros). */
  current: number;
  /** Saldo apenas com lançamentos até hoje. */
  available: number;
  /** Total de lançamentos com data futura (líquido). */
  scheduled: number;
  /** Saldo persistido no banco. */
  stored: number;
  /** current - stored (0 = sem divergência). */
  divergence: number;
  count: number;
}

const sumCents = (txs: AccountTx[], pick: (tx: AccountTx) => boolean): number =>
  txs.reduce((acc, tx) => (pick(tx) ? acc + toCents(tx.amount) : acc), 0);

export const summarizeAccount = (
  account: AccountRecord,
  txs: AccountTx[],
  today: string = todaySaoPaulo(),
): AccountBalanceSummary => {
  const own = txs.filter((t) => t.accountId === account.id);
  const initialCents = toCents(account.initialBalance || 0);

  const incomeCents = sumCents(own, (t) => t.type === "income" && !isTransferTx(t));
  const expenseCents = sumCents(own, (t) => t.type === "expense" && !isTransferTx(t));
  const transferInCents = sumCents(own, (t) => t.referenceType === TRANSFER_IN);
  const transferOutCents = sumCents(own, (t) => t.referenceType === TRANSFER_OUT);

  const movementCents = incomeCents + transferInCents - expenseCents - transferOutCents;
  const currentCents = initialCents + movementCents;

  const futureCents = own.reduce((acc, t) => {
    if (dateOnly(t.date) <= today) return acc;
    return acc + (t.type === "income" ? toCents(t.amount) : -toCents(t.amount));
  }, 0);

  const storedCents = toCents(account.storedBalance || 0);

  return {
    accountId: account.id,
    initial: fromCents(initialCents),
    income: fromCents(incomeCents),
    expense: fromCents(expenseCents),
    transferIn: fromCents(transferInCents),
    transferOut: fromCents(transferOutCents),
    current: fromCents(currentCents),
    available: fromCents(currentCents - futureCents),
    scheduled: fromCents(futureCents),
    stored: fromCents(storedCents),
    divergence: fromCents(currentCents - storedCents),
    count: own.length,
  };
};

export const totalBalance = (summaries: AccountBalanceSummary[]): number =>
  fromCents(summaries.reduce((acc, s) => acc + toCents(s.current), 0));

/** Saldo acumulado por lançamento (extrato), do mais antigo para o mais novo. */
export const withRunningBalance = <T extends AccountTx>(
  txs: T[],
  opening: number,
): Array<T & { runningBalance: number }> => {
  const ordered = [...txs].sort((a, b) =>
    a.date === b.date
      ? (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      : a.date.localeCompare(b.date),
  );
  let acc = toCents(opening);
  return ordered.map((tx) => {
    acc += tx.type === "income" ? toCents(tx.amount) : -toCents(tx.amount);
    return { ...tx, runningBalance: fromCents(acc) };
  });
};

/** Saldo de abertura da conta em uma data (exclusive). */
export const openingBalanceAt = (
  account: AccountRecord,
  txs: AccountTx[],
  date: string,
): number => {
  const cents = txs
    .filter((t) => t.accountId === account.id && dateOnly(t.date) < dateOnly(date))
    .reduce((acc, t) => acc + (t.type === "income" ? toCents(t.amount) : -toCents(t.amount)), 0);
  return fromCents(toCents(account.initialBalance || 0) + cents);
};

/* -------------------------------------------------------- conciliação */

/**
 * Status do lançamento:
 * - `futuro`: data posterior a hoje (previsto, ainda não afeta o disponível);
 * - `conciliado`: possui origem rastreada (reference_type/id) ou foi conciliado manualmente;
 * - `pendente`: lançamento avulso ainda não conferido.
 */
export const txStatus = (
  tx: AccountTx,
  reconciledIds: ReadonlySet<string> = new Set(),
  today: string = todaySaoPaulo(),
): TxStatus => {
  if (dateOnly(tx.date) > today) return "futuro";
  if (reconciledIds.has(tx.id)) return "conciliado";
  return tx.referenceType && tx.referenceId ? "conciliado" : "pendente";
};

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  conciliado: "Conciliado",
  pendente: "Pendente",
  futuro: "Futuro",
};

/* ------------------------------------------------------------ filtros */

export interface StatementFilters {
  range?: DateRange;
  accountIds?: string[];
  type?: TxType | "all";
  status?: TxStatus | "all";
  categories?: string[];
  search?: string;
  includeTransfers?: boolean;
}

export const normalizeText = (value?: string | null): string =>
  (value ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const filterStatement = (
  txs: AccountTx[],
  filters: StatementFilters,
  reconciledIds: ReadonlySet<string> = new Set(),
  today: string = todaySaoPaulo(),
): AccountTx[] => {
  const term = normalizeText(filters.search);
  return txs.filter((tx) => {
    if (filters.range && !inRange(tx.date, filters.range)) return false;
    if (filters.accountIds?.length && !filters.accountIds.includes(tx.accountId ?? "")) return false;
    if (filters.type && filters.type !== "all" && tx.type !== filters.type) return false;
    if (filters.includeTransfers === false && isTransferTx(tx)) return false;
    if (filters.categories?.length && !filters.categories.includes(tx.category ?? "Sem categoria"))
      return false;
    if (filters.status && filters.status !== "all") {
      if (txStatus(tx, reconciledIds, today) !== filters.status) return false;
    }
    if (term) {
      const haystack = normalizeText(
        `${tx.description} ${tx.category ?? ""} ${tx.notes ?? ""} ${tx.referenceType ?? ""}`,
      );
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
};

export const listCategories = (txs: AccountTx[]): string[] =>
  Array.from(new Set(txs.map((t) => t.category?.trim() || "Sem categoria"))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

/* ------------------------------------------------------- duplicidade */

/** Chave de duplicidade: conta + data + tipo + valor + descrição normalizada. */
export const duplicateKey = (tx: {
  accountId: string | null;
  date: string;
  type: TxType;
  amount: number;
  description: string;
}): string =>
  [
    tx.accountId ?? "-",
    dateOnly(tx.date),
    tx.type,
    toCents(tx.amount),
    normalizeText(tx.description),
  ].join("|");

export const findDuplicates = (
  existing: AccountTx[],
  candidate: Pick<AccountTx, "accountId" | "date" | "type" | "amount" | "description">,
): AccountTx[] => {
  const key = duplicateKey(candidate);
  return existing.filter((tx) => duplicateKey(tx) === key);
};

/* ----------------------------------------------------- transferências */

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export const validateTransfer = (
  input: TransferInput,
  accounts: AccountRecord[],
  balances: Map<string, AccountBalanceSummary>,
  closedThrough?: (accountId: string) => string | null,
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const from = accounts.find((a) => a.id === input.fromAccountId);
  const to = accounts.find((a) => a.id === input.toAccountId);

  if (!from) errors.push("Conta de origem não encontrada.");
  if (!to) errors.push("Conta de destino não encontrada.");
  if (from && to && from.id === to.id) errors.push("Origem e destino devem ser contas diferentes.");
  if (from && !from.isActive) errors.push("A conta de origem está inativa.");
  if (to && !to.isActive) errors.push("A conta de destino está inativa.");

  if (!(input.amount > 0)) errors.push("Informe um valor maior que zero.");
  if (toCents(input.amount || 0) !== Math.trunc(toCents(input.amount || 0)))
    errors.push("Valor inválido: use no máximo duas casas decimais.");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) errors.push("Informe uma data válida.");

  if (closedThrough && from) {
    const limit = closedThrough(from.id);
    if (limit && dateOnly(input.date) <= limit)
      errors.push(`Período fechado até ${limit} na conta de origem.`);
  }
  if (closedThrough && to) {
    const limit = closedThrough(to.id);
    if (limit && dateOnly(input.date) <= limit)
      errors.push(`Período fechado até ${limit} na conta de destino.`);
  }

  const fromBalance = from ? balances.get(from.id) : undefined;
  if (fromBalance && toCents(input.amount || 0) > toCents(fromBalance.current)) {
    warnings.push("A transferência deixará a conta de origem com saldo negativo.");
  }

  if (input.date && dateOnly(input.date) > todaySaoPaulo()) {
    warnings.push("A data informada é futura: o lançamento entra como previsto.");
  }

  return { ok: errors.length === 0, errors, warnings };
};

export interface TransferRow {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  category: string;
  transaction_type: TxType;
  amount: number;
  reference_type: string;
  reference_id: string;
}

/** Monta as duas pernas da transferência com o mesmo grupo de rastreabilidade. */
export const buildTransferRows = (
  input: TransferInput,
  fromName: string,
  toName: string,
  groupId: string,
): [TransferRow, TransferRow] => {
  const suffix = input.description?.trim() ? ` - ${input.description.trim()}` : "";
  return [
    {
      bank_account_id: input.fromAccountId,
      transaction_date: input.date,
      description: `Transferência para ${toName}${suffix}`,
      category: TRANSFER_CATEGORY,
      transaction_type: "expense",
      amount: input.amount,
      reference_type: TRANSFER_OUT,
      reference_id: groupId,
    },
    {
      bank_account_id: input.toAccountId,
      transaction_date: input.date,
      description: `Transferência de ${fromName}${suffix}`,
      category: TRANSFER_CATEGORY,
      transaction_type: "income",
      amount: input.amount,
      reference_type: TRANSFER_IN,
      reference_id: groupId,
    },
  ];
};

/* ---------------------------------------------------------- estornos */

export const REVERSAL_PREFIX = "Estorno";

/** Estorno = contrapartida de sinal oposto, nunca exclusão do original. */
export const buildReversalRow = (
  tx: AccountTx,
  date: string,
  reason?: string,
): Omit<TransferRow, "reference_type" | "reference_id"> & {
  reference_type: string;
  reference_id: string;
  notes: string;
} => ({
  bank_account_id: tx.accountId ?? "",
  transaction_date: date,
  description: `${REVERSAL_PREFIX} - ${tx.description}`,
  category: tx.category ?? "Estornos",
  transaction_type: tx.type === "income" ? "expense" : "income",
  amount: tx.amount,
  reference_type: "bank_transaction_reversal",
  reference_id: tx.id,
  notes: reason?.trim() || "Estorno de lançamento bancário",
});

export const isReversed = (tx: AccountTx, all: AccountTx[]): boolean =>
  all.some((t) => t.referenceType === "bank_transaction_reversal" && t.referenceId === tx.id);

export const validateReversal = (
  tx: AccountTx,
  all: AccountTx[],
  closedThrough?: string | null,
): ValidationResult => {
  const errors: string[] = [];
  if (!tx.accountId) errors.push("Lançamento sem conta vinculada.");
  if (isReversed(tx, all)) errors.push("Este lançamento já possui estorno registrado.");
  if (isTransferTx(tx))
    errors.push("Use o estorno da transferência completa, não de uma perna isolada.");
  if (closedThrough && dateOnly(tx.date) <= closedThrough)
    errors.push(`Período fechado até ${closedThrough}: estorno bloqueado.`);
  return { ok: errors.length === 0, errors, warnings: [] };
};

/* --------------------------------------------------- fechamento período */

export interface PeriodClosing {
  id: string;
  accountId: string;
  /** Última data fechada (inclusive). */
  closedThrough: string;
  closingBalance: number;
  notes?: string | null;
  createdAt?: string | null;
}

export const closedThroughFor = (
  closings: PeriodClosing[],
  accountId: string,
): string | null =>
  closings
    .filter((c) => c.accountId === accountId)
    .map((c) => dateOnly(c.closedThrough))
    .sort()
    .pop() ?? null;

export const isDateLocked = (
  closings: PeriodClosing[],
  accountId: string,
  date: string,
): boolean => {
  const limit = closedThroughFor(closings, accountId);
  return !!limit && dateOnly(date) <= limit;
};

export const validateClosing = (
  accountId: string,
  closedThrough: string,
  closings: PeriodClosing[],
  today: string = todaySaoPaulo(),
): ValidationResult => {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closedThrough)) errors.push("Informe uma data válida.");
  if (dateOnly(closedThrough) > today) errors.push("Não é possível fechar um período futuro.");
  const current = closedThroughFor(closings, accountId);
  if (current && dateOnly(closedThrough) <= current)
    errors.push(`Já existe fechamento até ${current} nesta conta.`);
  return { ok: errors.length === 0, errors, warnings: [] };
};

/* ------------------------------------------------- contas e cartões */

export const validateAccount = (
  input: { name: string; type: AccountType; initialBalance: number },
  accounts: AccountRecord[],
  editingId?: string,
): ValidationResult => {
  const errors: string[] = [];
  const name = input.name?.trim() ?? "";
  if (name.length < 2) errors.push("Informe um nome com pelo menos 2 caracteres.");
  if (name.length > 80) errors.push("O nome deve ter no máximo 80 caracteres.");
  if (
    accounts.some((a) => a.id !== editingId && normalizeText(a.name) === normalizeText(name))
  )
    errors.push("Já existe uma conta com este nome.");
  if (!["checking", "savings", "cash"].includes(input.type)) errors.push("Tipo de conta inválido.");
  if (!Number.isFinite(input.initialBalance)) errors.push("Saldo inicial inválido.");
  return { ok: errors.length === 0, errors, warnings: [] };
};

export const validateCard = (
  input: { name: string; cardNumber: string; limitAmount: number | null },
  cards: CardRecord[],
  editingId?: string,
): ValidationResult => {
  const errors: string[] = [];
  const name = input.name?.trim() ?? "";
  const digits = (input.cardNumber ?? "").replace(/\D/g, "");
  if (name.length < 2) errors.push("Informe o nome do cartão.");
  if (digits.length !== 4) errors.push("Informe exatamente os 4 últimos dígitos.");
  if (
    cards.some(
      (c) =>
        c.id !== editingId &&
        normalizeText(c.name) === normalizeText(name) &&
        c.cardNumber.replace(/\D/g, "").slice(-4) === digits,
    )
  )
    errors.push("Já existe um cartão com este nome e final.");
  if (input.limitAmount != null && input.limitAmount < 0) errors.push("Limite não pode ser negativo.");
  return { ok: errors.length === 0, errors, warnings: [] };
};

export interface CardUsage {
  cardId: string;
  spent: number;
  paid: number;
  balance: number;
  available: number | null;
  usagePercent: number | null;
}

export const summarizeCard = (card: CardRecord, txs: CardTx[]): CardUsage => {
  const own = txs.filter((t) => t.cardId === card.id);
  const spentCents = own
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + toCents(t.amount), 0);
  const paidCents = own
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + toCents(t.amount), 0);
  const balanceCents = spentCents - paidCents;
  const limitCents = card.limitAmount != null ? toCents(card.limitAmount) : null;
  return {
    cardId: card.id,
    spent: fromCents(spentCents),
    paid: fromCents(paidCents),
    balance: fromCents(balanceCents),
    available: limitCents == null ? null : fromCents(limitCents - balanceCents),
    usagePercent:
      limitCents == null || limitCents === 0
        ? null
        : Math.round((balanceCents / limitCents) * 1000) / 10,
  };
};

/** Só é seguro inativar (nunca excluir) quando existe histórico. */
export const canDeleteAccount = (accountId: string, txs: AccountTx[]): boolean =>
  !txs.some((t) => t.accountId === accountId);

/* ---------------------------------------------------------- exportação */

export interface StatementExportRow {
  data: string;
  time?: string | null;
  createdAt?: string | null;
  conta: string;
  descricao: string;
  categoria: string;
  tipo: string;
  status: string;
  valor: number;
  saldo: number;
  origem: string;
}

export const toExportRows = (
  txs: Array<AccountTx & { runningBalance?: number }>,
  accountName: (id: string | null) => string,
  reconciledIds: ReadonlySet<string> = new Set(),
  today: string = todaySaoPaulo(),
): StatementExportRow[] =>
  txs.map((tx) => ({
    data: dateOnly(tx.date),
    time: tx.time ?? null,
    createdAt: tx.createdAt ?? null,
    conta: accountName(tx.accountId),
    descricao: tx.description,
    categoria: tx.category ?? "Sem categoria",
    tipo: tx.type === "income" ? "Entrada" : "Saída",
    status: TX_STATUS_LABEL[txStatus(tx, reconciledIds, today)],
    valor: tx.type === "income" ? tx.amount : -tx.amount,
    saldo: tx.runningBalance ?? 0,
    origem: tx.referenceType ? `${tx.referenceType}:${tx.referenceId ?? ""}` : "Manual",
  }));
