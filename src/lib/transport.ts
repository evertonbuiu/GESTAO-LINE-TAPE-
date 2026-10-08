/**
 * Regras de negócio do módulo Transporte Interestadual.
 * Todo cálculo monetário é feito em centavos (inteiros) para evitar erros de ponto flutuante.
 */

export type TransportStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';

export const TRANSPORT_STATUSES: TransportStatus[] = [
  'planned',
  'in_transit',
  'completed',
  'cancelled',
];

const STATUS_LABELS: Record<TransportStatus, string> = {
  planned: 'Planejada',
  in_transit: 'Em trânsito',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

/** Status legados gravados antes da padronização. */
const LEGACY_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

export function isTransportStatus(value: unknown): value is TransportStatus {
  return typeof value === 'string' && (TRANSPORT_STATUSES as string[]).includes(value);
}

export function getTransportStatusLabel(status: string): string {
  if (isTransportStatus(status)) return STATUS_LABELS[status];
  return LEGACY_STATUS_LABELS[status] ?? status;
}

export function getTransportStatusVariant(status: string): string {
  switch (status) {
    case 'planned':
    case 'pending':
      return 'pending';
    case 'in_transit':
      return 'default';
    case 'completed':
    case 'approved':
      return 'confirmed';
    case 'cancelled':
    case 'rejected':
      return 'cancelled';
    default:
      return 'outline';
  }
}

const ALLOWED_TRANSITIONS: Record<TransportStatus, TransportStatus[]> = {
  planned: ['in_transit', 'cancelled'],
  in_transit: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function normalizeTransportStatus(status: string | null | undefined): TransportStatus {
  if (isTransportStatus(status)) return status;
  switch (status) {
    case 'approved':
      return 'completed';
    case 'rejected':
      return 'cancelled';
    default:
      return 'planned';
  }
}

export function canTransitionTransportStatus(from: string, to: string): boolean {
  if (!isTransportStatus(to)) return false;
  const current = normalizeTransportStatus(from);
  return ALLOWED_TRANSITIONS[current].includes(to);
}

export function nextTransportStatuses(from: string): TransportStatus[] {
  return ALLOWED_TRANSITIONS[normalizeTransportStatus(from)];
}

export function isCriticalTransportTransition(to: string): boolean {
  return to === 'completed' || to === 'cancelled';
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

/** Converte 'YYYY-MM-DD' em Date local (sem deslocamento de fuso). */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(value?: string | null): string {
  if (!value) return '-';
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('pt-BR') : '-';
}

export interface TransportDatesInput {
  transport_date?: string | null;
  arrival_date?: string | null;
  expected_return_date?: string | null;
}

export function validateTransportDates(input: TransportDatesInput): string[] {
  const errors: string[] = [];
  const start = input.transport_date ? parseLocalDate(input.transport_date) : null;
  if (!start) {
    errors.push('Informe a data de saída.');
    return errors;
  }
  const arrival = input.arrival_date ? parseLocalDate(input.arrival_date) : null;
  if (input.arrival_date && !arrival) errors.push('Data de chegada inválida.');
  if (arrival && arrival < start) errors.push('A data de chegada não pode ser anterior à data de saída.');

  const ret = input.expected_return_date ? parseLocalDate(input.expected_return_date) : null;
  if (input.expected_return_date && !ret) errors.push('Data de retorno inválida.');
  if (ret && ret < start) errors.push('A data de retorno não pode ser anterior à data de saída.');
  if (ret && arrival && ret < arrival) errors.push('A data de retorno não pode ser anterior à chegada.');
  return errors;
}

/* ------------------------------------------------------------------ */
/* Conflitos de agenda                                                 */
/* ------------------------------------------------------------------ */

export interface TransportScheduleItem {
  id?: string;
  status?: string | null;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  transport_date: string;
  expected_return_date?: string | null;
  arrival_date?: string | null;
}

function periodEnd(item: TransportScheduleItem): Date | null {
  return (
    (item.expected_return_date ? parseLocalDate(item.expected_return_date) : null) ??
    (item.arrival_date ? parseLocalDate(item.arrival_date) : null) ??
    parseLocalDate(item.transport_date)
  );
}

function overlaps(a: TransportScheduleItem, b: TransportScheduleItem): boolean {
  const aStart = parseLocalDate(a.transport_date);
  const bStart = parseLocalDate(b.transport_date);
  const aEnd = periodEnd(a);
  const bEnd = periodEnd(b);
  if (!aStart || !bStart || !aEnd || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

const norm = (value?: string | null) => (value ?? '').trim().toUpperCase();

export interface TransportConflict {
  id?: string;
  reason: 'vehicle' | 'driver';
  message: string;
}

export function findTransportConflicts(
  candidate: TransportScheduleItem,
  existing: TransportScheduleItem[],
): TransportConflict[] {
  const conflicts: TransportConflict[] = [];
  for (const item of existing) {
    if (candidate.id && item.id === candidate.id) continue;
    if (normalizeTransportStatus(item.status) === 'cancelled') continue;
    if (!overlaps(candidate, item)) continue;

    if (norm(candidate.vehicle_plate) && norm(candidate.vehicle_plate) === norm(item.vehicle_plate)) {
      conflicts.push({
        id: item.id,
        reason: 'vehicle',
        message: `Veículo ${item.vehicle_plate} já está em viagem em ${formatLocalDate(item.transport_date)}.`,
      });
      continue;
    }
    if (norm(candidate.driver_name) && norm(candidate.driver_name) === norm(item.driver_name)) {
      conflicts.push({
        id: item.id,
        reason: 'driver',
        message: `Motorista ${item.driver_name} já está em viagem em ${formatLocalDate(item.transport_date)}.`,
      });
    }
  }
  return conflicts;
}

/* ------------------------------------------------------------------ */
/* Dinheiro em centavos                                                */
/* ------------------------------------------------------------------ */

export function toCents(value: number | string | null | undefined): number {
  const num = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON * Math.sign(num || 1)) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents ?? 0) / 100;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fromCents(cents));
}

export interface TransportCostInput {
  distance_km?: number | null;
  fuel_consumption_kmpl?: number | null;
  fuel_price_cents?: number | null;
  fuel_cost_cents?: number | null;
  toll_cents?: number | null;
  lodging_cents?: number | null;
  meals_cents?: number | null;
  daily_rate_cents?: number | null;
  maintenance_cents?: number | null;
  freight_cents?: number | null;
  advance_cents?: number | null;
  extra_cents?: number | null;
  revenue_cents?: number | null;
}

const int = (value: number | null | undefined) => {
  const num = Math.round(Number(value ?? 0));
  return Number.isFinite(num) && num > 0 ? num : 0;
};

/** Custo estimado de combustível: (km / km-por-litro) * preço do litro. */
export function estimateFuelCostCents(input: TransportCostInput): number {
  const km = Number(input.distance_km ?? 0);
  const kmpl = Number(input.fuel_consumption_kmpl ?? 0);
  const price = int(input.fuel_price_cents);
  if (!(km > 0) || !(kmpl > 0) || price <= 0) return 0;
  return Math.round((km / kmpl) * price);
}

export interface TransportTotals {
  fuelCents: number;
  totalCostCents: number;
  revenueCents: number;
  marginCents: number;
  marginPercent: number;
  balanceCents: number;
  costPerKmCents: number;
}

export function calculateTransportTotals(input: TransportCostInput): TransportTotals {
  const fuelCents = int(input.fuel_cost_cents) || estimateFuelCostCents(input);
  const totalCostCents =
    fuelCents +
    int(input.toll_cents) +
    int(input.lodging_cents) +
    int(input.meals_cents) +
    int(input.daily_rate_cents) +
    int(input.maintenance_cents) +
    int(input.freight_cents) +
    int(input.extra_cents);
  const revenueCents = int(input.revenue_cents);
  const marginCents = revenueCents - totalCostCents;
  const marginPercent = revenueCents > 0 ? Math.round((marginCents / revenueCents) * 10000) / 100 : 0;
  const km = Number(input.distance_km ?? 0);
  return {
    fuelCents,
    totalCostCents,
    revenueCents,
    marginCents,
    marginPercent,
    balanceCents: totalCostCents - int(input.advance_cents),
    costPerKmCents: km > 0 ? Math.round(totalCostCents / km) : 0,
  };
}

export function summarizeTransports(items: (TransportCostInput & { status?: string | null })[]) {
  const active = items.filter((i) => normalizeTransportStatus(i.status) !== 'cancelled');
  const totals = active.map(calculateTransportTotals);
  const totalCostCents = totals.reduce((sum, t) => sum + t.totalCostCents, 0);
  const revenueCents = totals.reduce((sum, t) => sum + t.revenueCents, 0);
  return {
    count: items.length,
    activeCount: active.length,
    totalCostCents,
    revenueCents,
    marginCents: revenueCents - totalCostCents,
    inTransit: items.filter((i) => normalizeTransportStatus(i.status) === 'in_transit').length,
    completed: items.filter((i) => normalizeTransportStatus(i.status) === 'completed').length,
  };
}

/* ------------------------------------------------------------------ */
/* Permissões e anexos                                                 */
/* ------------------------------------------------------------------ */

export const TRANSPORT_READ_ROLES = ['admin', 'financeiro', 'funcionario', 'deposito'];
export const TRANSPORT_WRITE_ROLES = ['admin', 'funcionario', 'deposito'];
export const TRANSPORT_FINANCE_ROLES = ['admin', 'financeiro'];

export function canViewTransports(role?: string | null): boolean {
  return TRANSPORT_READ_ROLES.includes(role ?? '');
}
export function canManageTransports(role?: string | null): boolean {
  return TRANSPORT_WRITE_ROLES.includes(role ?? '');
}
export function canViewTransportValues(role?: string | null): boolean {
  return TRANSPORT_FINANCE_ROLES.includes(role ?? '');
}

export const TRANSPORT_RECEIPT_PREFIX = 'interstate-transports';

/** Caminho no bucket privado: interstate-transports/<uid>-<timestamp>.<ext> */
export function buildTransportReceiptPath(userId: string, fileName: string, now = Date.now()): string {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${TRANSPORT_RECEIPT_PREFIX}/${userId}-${now}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Busca / filtros                                                     */
/* ------------------------------------------------------------------ */

export interface TransportFilterOptions {
  search?: string;
  status?: string;
}

export function filterTransports<
  T extends {
    status?: string | null;
    destination?: string | null;
    destination_state?: string | null;
    origin_city?: string | null;
    origin_state?: string | null;
    driver_name?: string | null;
    vehicle_plate?: string | null;
    invoice_number?: string | null;
    cargo_type?: string | null;
  },
>(items: T[], { search = '', status = 'all' }: TransportFilterOptions): T[] {
  const term = search.trim().toLowerCase();
  return items.filter((item) => {
    if (status !== 'all' && normalizeTransportStatus(item.status) !== status) return false;
    if (!term) return true;
    return [
      item.destination,
      item.destination_state,
      item.origin_city,
      item.origin_state,
      item.driver_name,
      item.vehicle_plate,
      item.invoice_number,
      item.cargo_type,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });
}

/* ------------------------------------------------------------------ */
/* Ordenação e paginação                                               */
/* ------------------------------------------------------------------ */

export type TransportSortKey = 'transport_date' | 'vehicle_plate' | 'driver_name' | 'cost' | 'status';
export type SortDirection = 'asc' | 'desc';

export function sortTransports<T extends TransportCostInput & Record<string, any>>(
  items: T[],
  key: TransportSortKey,
  direction: SortDirection = 'desc',
): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    let result = 0;
    if (key === 'cost') {
      result = calculateTransportTotals(a).totalCostCents - calculateTransportTotals(b).totalCostCents;
    } else if (key === 'status') {
      result = normalizeTransportStatus(a.status).localeCompare(normalizeTransportStatus(b.status));
    } else {
      result = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'pt-BR');
    }
    if (result === 0) result = String(a.id ?? '').localeCompare(String(b.id ?? ''));
    return result * factor;
  });
}

export const TRANSPORT_PAGE_SIZE = 10;

export interface PageResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export function paginateTransports<T>(items: T[], page: number, pageSize = TRANSPORT_PAGE_SIZE): PageResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, totalPages, total };
}

/* ------------------------------------------------------------------ */
/* Formulário <-> registro                                             */
/* ------------------------------------------------------------------ */

export interface TransportLeg {
  from: string;
  to: string;
  km: number;
}

/** Valores monetários do formulário são em REAIS; a persistência é em centavos. */
export interface TransportFormValues {
  transport_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  expected_return_date: string;
  origin_city: string;
  origin_state: string;
  destination: string;
  destination_state: string;
  distance_km: number;
  legs: TransportLeg[];
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_capacity_kg: number;
  driver_name: string;
  driver_cpf: string;
  driver_phone: string;
  helpers: string[];
  event_id: string;
  cargo_type: string;
  cargo_weight: number;
  cargo_value: number;
  invoice_number: string;
  notes: string;
  fuel_consumption_kmpl: number;
  fuel_price: number;
  fuel_cost: number;
  toll: number;
  lodging: number;
  meals: number;
  daily_rate: number;
  maintenance: number;
  freight: number;
  advance: number;
  extra: number;
  revenue: number;
  receipt_path: string | null;
}

export const emptyTransportForm: TransportFormValues = {
  transport_date: '',
  departure_time: '',
  arrival_date: '',
  arrival_time: '',
  expected_return_date: '',
  origin_city: '',
  origin_state: '',
  destination: '',
  destination_state: '',
  distance_km: 0,
  legs: [],
  vehicle_plate: '',
  vehicle_model: '',
  vehicle_capacity_kg: 0,
  driver_name: '',
  driver_cpf: '',
  driver_phone: '',
  helpers: [],
  event_id: '',
  cargo_type: '',
  cargo_weight: 0,
  cargo_value: 0,
  invoice_number: '',
  notes: '',
  fuel_consumption_kmpl: 0,
  fuel_price: 0,
  fuel_cost: 0,
  toll: 0,
  lodging: 0,
  meals: 0,
  daily_rate: 0,
  maintenance: 0,
  freight: 0,
  advance: 0,
  extra: 0,
  revenue: 0,
  receipt_path: null,
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const text = (value: unknown) => String(value ?? '').trim();
const nullable = (value: unknown) => text(value) || null;
/** Horários vazios devem virar NULL (coluna `time`). */
const timeOrNull = (value: unknown) => (/^\d{2}:\d{2}/.test(text(value)) ? text(value).slice(0, 5) : null);

export function transportFormCosts(form: TransportFormValues): TransportCostInput {
  return {
    distance_km: num(form.distance_km),
    fuel_consumption_kmpl: num(form.fuel_consumption_kmpl),
    fuel_price_cents: toCents(form.fuel_price),
    fuel_cost_cents: toCents(form.fuel_cost),
    toll_cents: toCents(form.toll),
    lodging_cents: toCents(form.lodging),
    meals_cents: toCents(form.meals),
    daily_rate_cents: toCents(form.daily_rate),
    maintenance_cents: toCents(form.maintenance),
    freight_cents: toCents(form.freight),
    advance_cents: toCents(form.advance),
    extra_cents: toCents(form.extra),
    revenue_cents: toCents(form.revenue),
  };
}

/** Payload pronto para INSERT/UPDATE em `interstate_transports`. */
export function transportFormToRecord(
  form: TransportFormValues,
  options: { userId: string; status?: string },
): Record<string, unknown> {
  const costs = transportFormCosts(form);
  const totals = calculateTransportTotals(costs);
  const legs = (form.legs ?? []).filter((leg) => text(leg.from) || text(leg.to)).map((leg) => ({
    from: text(leg.from),
    to: text(leg.to),
    km: num(leg.km),
  }));
  const helpers = (form.helpers ?? []).map(text).filter(Boolean);

  return {
    transport_date: form.transport_date,
    departure_time: timeOrNull(form.departure_time),
    arrival_date: nullable(form.arrival_date),
    arrival_time: timeOrNull(form.arrival_time),
    expected_return_date: nullable(form.expected_return_date),
    origin_city: nullable(form.origin_city),
    origin_state: nullable(form.origin_state),
    destination: text(form.destination),
    destination_state: nullable(form.destination_state) ?? nullable(form.destination),
    distance_km: num(form.distance_km),
    legs,
    vehicle_plate: text(form.vehicle_plate).toUpperCase(),
    vehicle_model: nullable(form.vehicle_model),
    vehicle_capacity_kg: num(form.vehicle_capacity_kg) || null,
    driver_name: text(form.driver_name),
    driver_cpf: nullable(form.driver_cpf),
    driver_phone: nullable(form.driver_phone),
    helpers,
    event_id: nullable(form.event_id),
    cargo_type: nullable(form.cargo_type),
    cargo_weight: num(form.cargo_weight),
    cargo_value: num(form.cargo_value),
    invoice_number: nullable(form.invoice_number),
    total_weight: num(form.cargo_weight),
    fuel_consumption_kmpl: num(form.fuel_consumption_kmpl),
    fuel_price_cents: toCents(form.fuel_price),
    fuel_cost_cents: totals.fuelCents,
    toll_cents: toCents(form.toll),
    lodging_cents: toCents(form.lodging),
    meals_cents: toCents(form.meals),
    daily_rate_cents: toCents(form.daily_rate),
    maintenance_cents: toCents(form.maintenance),
    freight_cents: toCents(form.freight),
    advance_cents: toCents(form.advance),
    extra_cents: toCents(form.extra),
    revenue_cents: toCents(form.revenue),
    estimated_cost: fromCents(totals.totalCostCents),
    receipt_path: form.receipt_path || null,
    notes: nullable(form.notes),
    status: normalizeTransportStatus(options.status),
    created_by: options.userId,
  };
}

/** Preenche o formulário a partir de um registro salvo (edição). */
export function recordToTransportForm(record: Record<string, any>): TransportFormValues {
  return {
    ...emptyTransportForm,
    transport_date: record.transport_date ?? '',
    departure_time: (record.departure_time ?? '').slice(0, 5),
    arrival_date: record.arrival_date ?? '',
    arrival_time: (record.arrival_time ?? '').slice(0, 5),
    expected_return_date: record.expected_return_date ?? '',
    origin_city: record.origin_city ?? '',
    origin_state: record.origin_state ?? '',
    destination: record.destination ?? '',
    destination_state: record.destination_state ?? record.destination ?? '',
    distance_km: Number(record.distance_km ?? 0),
    legs: Array.isArray(record.legs) ? record.legs : [],
    vehicle_plate: record.vehicle_plate ?? '',
    vehicle_model: record.vehicle_model ?? '',
    vehicle_capacity_kg: Number(record.vehicle_capacity_kg ?? 0),
    driver_name: record.driver_name ?? '',
    driver_cpf: record.driver_cpf ?? '',
    driver_phone: record.driver_phone ?? '',
    helpers: Array.isArray(record.helpers) ? record.helpers.map((h: any) => (typeof h === 'string' ? h : h?.name ?? '')) : [],
    event_id: record.event_id ?? '',
    cargo_type: record.cargo_type ?? '',
    cargo_weight: Number(record.cargo_weight ?? 0),
    cargo_value: Number(record.cargo_value ?? 0),
    invoice_number: record.invoice_number ?? '',
    notes: record.notes ?? '',
    fuel_consumption_kmpl: Number(record.fuel_consumption_kmpl ?? 0),
    fuel_price: fromCents(record.fuel_price_cents ?? 0),
    fuel_cost: fromCents(record.fuel_cost_cents ?? 0),
    toll: fromCents(record.toll_cents ?? 0),
    lodging: fromCents(record.lodging_cents ?? 0),
    meals: fromCents(record.meals_cents ?? 0),
    daily_rate: fromCents(record.daily_rate_cents ?? 0),
    maintenance: fromCents(record.maintenance_cents ?? 0),
    freight: fromCents(record.freight_cents ?? 0),
    advance: fromCents(record.advance_cents ?? 0),
    extra: fromCents(record.extra_cents ?? 0),
    revenue: fromCents(record.revenue_cents ?? 0),
    receipt_path: record.receipt_path ?? null,
  };
}

/** Validação completa do formulário (obrigatórios, datas, capacidade). */
export function validateTransportForm(form: TransportFormValues): string[] {
  const errors: string[] = [];
  if (!text(form.destination)) errors.push('Informe o destino.');
  if (!text(form.driver_name)) errors.push('Informe o motorista.');
  if (!text(form.vehicle_plate)) errors.push('Informe a placa do veículo.');
  errors.push(...validateTransportDates(form));

  if (Number(form.distance_km) < 0) errors.push('A distância não pode ser negativa.');
  const negative = (['fuel_price', 'fuel_cost', 'toll', 'lodging', 'meals', 'daily_rate', 'maintenance', 'freight', 'advance', 'extra', 'revenue'] as const)
    .some((key) => Number(form[key]) < 0);
  if (negative) errors.push('Os valores financeiros não podem ser negativos.');

  const capacity = num(form.vehicle_capacity_kg);
  if (capacity > 0 && num(form.cargo_weight) > capacity) {
    errors.push('O peso da carga excede a capacidade do veículo.');
  }
  return errors;
}

