/**
 * Regras puras do módulo de Locações (eventos).
 *
 * Este arquivo concentra cálculos monetários, validação de datas/conflitos,
 * transições de status, disponibilidade de estoque e filtros de listagem.
 * Não importa Supabase nem React de propósito: é testável e reutilizável.
 */

export type RentalStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const RENTAL_STATUSES: RentalStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

const STATUS_LABELS: Record<RentalStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export function rentalStatusLabel(status: string): string {
  return STATUS_LABELS[status as RentalStatus] ?? status;
}

/** Transições permitidas. Concluído e Cancelado são terminais. */
const ALLOWED_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function nextRentalStatuses(current: string): RentalStatus[] {
  return ALLOWED_TRANSITIONS[current as RentalStatus] ?? [];
}

export function canTransitionRentalStatus(from: string, to: string): boolean {
  if (from === to) return false;
  return nextRentalStatuses(from).includes(to as RentalStatus);
}

/** Ações críticas exigem confirmação explícita do usuário. */
export function isCriticalRentalTransition(to: string): boolean {
  return to === 'cancelled' || to === 'completed';
}

/* -------------------------------------------------------------------------- */
/* Datas e conflitos                                                          */
/* -------------------------------------------------------------------------- */

/** Converte 'YYYY-MM-DD' (ou ISO) em Date local ao meio-dia, evitando shift de fuso. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface RentalDatesInput {
  setup_start_date?: string | null;
  event_date?: string | null;
  end_date?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRentalDates(input: RentalDatesInput): ValidationResult {
  const errors: string[] = [];
  const event = parseLocalDate(input.event_date);
  if (!event) {
    errors.push('Informe a data do evento.');
  }
  const setup = parseLocalDate(input.setup_start_date);
  if (input.setup_start_date && !setup) {
    errors.push('Data de montagem inválida.');
  }
  if (setup && event && setup.getTime() > event.getTime()) {
    errors.push('A montagem não pode começar depois da data do evento.');
  }
  const end = parseLocalDate(input.end_date);
  if (end && event && end.getTime() < event.getTime()) {
    errors.push('A data de devolução não pode ser anterior à data do evento.');
  }
  return { valid: errors.length === 0, errors };
}

/** Número de diárias cobradas (mínimo 1), inclusivo nas pontas. */
export function rentalDays(startDate?: string | null, endDate?: string | null): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start) return 0;
  if (!end) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

export interface RentalLike {
  id: string;
  name?: string | null;
  status?: string | null;
  location?: string | null;
  setup_start_date?: string | null;
  event_date?: string | null;
  end_date?: string | null;
}

function occupiedRange(rental: RentalLike): [number, number] | null {
  const event = parseLocalDate(rental.event_date);
  if (!event) return null;
  const start = parseLocalDate(rental.setup_start_date) ?? event;
  const end = parseLocalDate(rental.end_date) ?? event;
  return [Math.min(start.getTime(), event.getTime()), Math.max(end.getTime(), event.getTime())];
}

function normalizeLocation(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Conflitos de agenda: locações ativas com períodos sobrepostos.
 * Mesmo local => conflito forte; datas sobrepostas em locais diferentes => aviso.
 */
export function detectScheduleConflicts(
  candidate: RentalLike,
  others: RentalLike[],
): Array<{ rental: RentalLike; severity: 'conflict' | 'warning' }> {
  const range = occupiedRange(candidate);
  if (!range) return [];
  const candLoc = normalizeLocation(candidate.location);

  return others
    .filter((other) => other.id !== candidate.id)
    .filter((other) => other.status !== 'cancelled' && other.status !== 'completed')
    .map((other) => {
      const otherRange = occupiedRange(other);
      if (!otherRange) return null;
      const overlaps = range[0] <= otherRange[1] && otherRange[0] <= range[1];
      if (!overlaps) return null;
      const otherLoc = normalizeLocation(other.location);
      const sameLocation = candLoc.length > 0 && candLoc === otherLoc;
      return { rental: other, severity: sameLocation ? 'conflict' : 'warning' } as const;
    })
    .filter((x): x is { rental: RentalLike; severity: 'conflict' | 'warning' } => x !== null);
}

/* -------------------------------------------------------------------------- */
/* Estoque / reserva                                                          */
/* -------------------------------------------------------------------------- */

export interface StockItem {
  name: string;
  total_stock: number;
}

export interface AllocationItem {
  equipment_name: string;
  quantity: number;
  status?: string | null;
  event_id?: string | null;
}

const ACTIVE_ALLOCATION_STATUSES = ['pending', 'confirmed', 'active', 'allocated', 'in_progress'];

export function isActiveAllocation(status?: string | null): boolean {
  return ACTIVE_ALLOCATION_STATUSES.includes((status ?? 'pending').toLowerCase());
}

/** Quantidade disponível de um item considerando alocações ativas (devolvidos liberam estoque). */
export function computeAvailableQuantity(
  stock: StockItem,
  allocations: AllocationItem[],
  options: { ignoreEventId?: string } = {},
): number {
  const used = allocations
    .filter((a) => a.equipment_name === stock.name)
    .filter((a) => !options.ignoreEventId || a.event_id !== options.ignoreEventId)
    .filter((a) => isActiveAllocation(a.status))
    .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  return Math.max(0, (Number(stock.total_stock) || 0) - used);
}

/** Valida uma reserva evitando dupla reserva/sobre-alocação. */
export function validateReservation(params: {
  stock: StockItem | undefined;
  allocations: AllocationItem[];
  quantity: number;
  eventId?: string;
  /** Alocação existente sendo editada (não deve contar contra ela mesma). */
  currentQuantity?: number;
}): ValidationResult & { available: number } {
  const { stock, allocations, quantity, eventId, currentQuantity = 0 } = params;
  const errors: string[] = [];

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    errors.push('Informe uma quantidade inteira maior que zero.');
  }
  if (!stock) {
    return { valid: false, errors: [...errors, 'Equipamento não encontrado no estoque.'], available: 0 };
  }

  const usedByOthers = allocations
    .filter((a) => a.equipment_name === stock.name)
    .filter((a) => isActiveAllocation(a.status))
    .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);

  const available = Math.max(0, (Number(stock.total_stock) || 0) - usedByOthers + currentQuantity);

  if (errors.length === 0 && quantity > available) {
    errors.push(
      `Quantidade indisponível: solicitado ${quantity}, disponível ${available} de ${stock.total_stock}.`,
    );
  }

  void eventId;
  return { valid: errors.length === 0, errors, available };
}

/* -------------------------------------------------------------------------- */
/* Dinheiro                                                                   */
/* -------------------------------------------------------------------------- */

export function toCents(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  // Corrige o erro binário de ponto flutuante (1.005 * 100 === 100.49999...).
  return Math.round(Number((n * 100).toFixed(6)));
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Arredondamento monetário estável (evita 1.005 -> 1.00). */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return fromCents(toCents(value));
}

export interface RentalPricingInput {
  /** Valor da diária por unidade. */
  dailyRate?: number;
  /** Quantidade de itens. */
  quantity?: number;
  /** Número de diárias. */
  days?: number;
  /** Itens adicionais (mão de obra, extras). */
  extras?: number;
  freight?: number;
  /** Desconto percentual (0-100). */
  discountPercentage?: number;
  /** Desconto em valor, aplicado após o percentual. */
  discountAmount?: number;
  /** Alíquota de imposto em percentual (0-100), calculada "por dentro". */
  taxPercentage?: number;
  /** Caução: não compõe o total do serviço, é reembolsável. */
  deposit?: number;
}

export interface RentalPricingTotals {
  subtotal: number;
  discount: number;
  freight: number;
  extras: number;
  taxableBase: number;
  tax: number;
  total: number;
  deposit: number;
  totalWithDeposit: number;
}

export function computeRentalTotals(input: RentalPricingInput): RentalPricingTotals {
  const dailyRate = toCents(input.dailyRate ?? 0);
  const quantity = Math.max(0, Math.trunc(input.quantity ?? 1));
  const days = Math.max(0, Math.trunc(input.days ?? 1));
  const extras = toCents(input.extras ?? 0);
  const freight = toCents(input.freight ?? 0);
  const deposit = toCents(input.deposit ?? 0);

  const subtotal = dailyRate * quantity * days;

  const pct = Math.min(100, Math.max(0, input.discountPercentage ?? 0));
  const pctDiscount = Math.round((subtotal * pct) / 100);
  const flatDiscount = toCents(input.discountAmount ?? 0);
  const discount = Math.min(subtotal, pctDiscount + flatDiscount);

  const taxableBase = subtotal - discount + extras + freight;

  const taxPct = Math.min(99.99, Math.max(0, input.taxPercentage ?? 0));
  // Imposto "por dentro": base / (1 - aliq) - base
  const tax = taxPct > 0 ? Math.round((taxableBase * taxPct) / (100 - taxPct)) : 0;

  const total = taxableBase + tax;

  return {
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    freight: fromCents(freight),
    extras: fromCents(extras),
    taxableBase: fromCents(taxableBase),
    tax: fromCents(tax),
    total: fromCents(total),
    deposit: fromCents(deposit),
    totalWithDeposit: fromCents(total + deposit),
  };
}

/* -------------------------------------------------------------------------- */
/* Pagamentos                                                                 */
/* -------------------------------------------------------------------------- */

export interface RentalPaymentLike {
  total_budget?: number | null;
  is_paid?: boolean | null;
  payment_type?: string | null;
  payment_amount?: number | null;
  is_remaining_paid?: boolean | null;
  remaining_payment_amount?: number | null;
}

export interface RentalPaymentSummary {
  total: number;
  paid: number;
  remaining: number;
  status: 'pendente' | 'parcial' | 'pago';
  label: string;
}

export function computePaymentSummary(event: RentalPaymentLike): RentalPaymentSummary {
  const totalCents = toCents(event.total_budget ?? 0);
  const entryCents = event.is_paid ? toCents(event.payment_amount ?? 0) : 0;

  const isEntry = (event.payment_type ?? '') === 'entrada';
  const remainingPaidCents =
    event.is_remaining_paid ? toCents(event.remaining_payment_amount ?? 0) : 0;

  let paidCents: number;
  if (!event.is_paid) {
    paidCents = 0;
  } else if (isEntry) {
    paidCents = entryCents + remainingPaidCents;
  } else {
    // Pagamento total: se não houver valor informado, considera o orçamento integral.
    paidCents = entryCents > 0 ? entryCents : totalCents;
  }

  paidCents = Math.min(paidCents, Math.max(totalCents, paidCents));
  const remainingCents = Math.max(0, totalCents - paidCents);

  const status: RentalPaymentSummary['status'] =
    remainingCents === 0 && totalCents > 0 && paidCents > 0
      ? 'pago'
      : paidCents > 0
        ? 'parcial'
        : 'pendente';

  const label = status === 'pago' ? 'Pago Total' : status === 'parcial' ? 'Pago Entrada' : 'Pendente';

  return {
    total: fromCents(totalCents),
    paid: fromCents(paidCents),
    remaining: fromCents(remainingCents),
    status,
    label,
  };
}

/* -------------------------------------------------------------------------- */
/* Busca, filtros, ordenação e paginação                                      */
/* -------------------------------------------------------------------------- */

export interface RentalFilterOptions {
  search?: string;
  status?: string | 'all';
  paymentStatus?: 'all' | 'pendente' | 'parcial' | 'pago';
  from?: string | null;
  to?: string | null;
}

type Searchable = RentalLike & RentalPaymentLike & { client_name?: string | null; location?: string | null };

export function filterRentals<T extends Searchable>(rentals: T[], options: RentalFilterOptions): T[] {
  const term = normalizeLocation(options.search ?? '');
  const from = parseLocalDate(options.from);
  const to = parseLocalDate(options.to);

  return rentals.filter((rental) => {
    if (options.status && options.status !== 'all' && rental.status !== options.status) return false;

    if (options.paymentStatus && options.paymentStatus !== 'all') {
      if (computePaymentSummary(rental).status !== options.paymentStatus) return false;
    }

    if (from || to) {
      const date = parseLocalDate(rental.event_date);
      if (!date) return false;
      if (from && date.getTime() < from.getTime()) return false;
      if (to && date.getTime() > to.getTime()) return false;
    }

    if (term) {
      const haystack = normalizeLocation(
        [rental.name, rental.client_name, rental.location].filter(Boolean).join(' '),
      );
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

export type RentalSortKey = 'event_date' | 'name' | 'client_name' | 'total_budget' | 'status';

export function sortRentals<T extends Searchable>(
  rentals: T[],
  key: RentalSortKey,
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rentals].sort((a, b) => {
    let result = 0;
    if (key === 'event_date') {
      const da = parseLocalDate(a.event_date)?.getTime() ?? 0;
      const db = parseLocalDate(b.event_date)?.getTime() ?? 0;
      result = da - db;
    } else if (key === 'total_budget') {
      result = toCents(a.total_budget ?? 0) - toCents(b.total_budget ?? 0);
    } else {
      const va = String((a as Record<string, unknown>)[key] ?? '');
      const vb = String((b as Record<string, unknown>)[key] ?? '');
      result = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
    }
    if (result === 0) return String(a.id).localeCompare(String(b.id));
    return result * factor;
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const safeSize = Math.max(1, Math.trunc(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    total: items.length,
    totalPages,
  };
}

/* -------------------------------------------------------------------------- */
/* Permissões                                                                 */
/* -------------------------------------------------------------------------- */

export type AppRole = 'admin' | 'financeiro' | 'funcionario' | 'deposito' | null | undefined;

export function canEditRentals(role: AppRole): boolean {
  return role === 'admin' || role === 'financeiro';
}

export function canDeleteRentals(role: AppRole): boolean {
  return role === 'admin';
}

/** Papéis operacionais não podem ver valores monetários. */
export function canViewRentalValues(role: AppRole): boolean {
  return role === 'admin' || role === 'financeiro';
}

export function canManageEquipmentAllocation(role: AppRole): boolean {
  return role === 'admin' || role === 'financeiro' || role === 'deposito';
}
