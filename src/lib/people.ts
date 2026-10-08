/**
 * Letra 3D line tape 2026 — Regras puras de Colaboradores e Diaristas.
 *
 * Este módulo NÃO acessa banco, rede ou DOM. Toda validação e cálculo
 * usado pelas telas de Colaboradores/Diaristas vive aqui para poder ser
 * testado isoladamente.
 */

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type PersonType = 'collaborator' | 'worker';

export type EmploymentType = 'fixo' | 'diarista' | 'freelancer';

export type PersonStatus = 'ativo' | 'inativo' | 'ferias' | 'afastado' | 'bloqueado';

export type AttendanceStatus =
  | 'prevista'
  | 'presente'
  | 'falta'
  | 'substituido'
  | 'cancelada';

export type PaymentStatus = 'pendente' | 'aprovado' | 'pago' | 'cancelado';

export type AvailabilityPeriod = 'integral' | 'manha' | 'tarde' | 'noite';

export type AvailabilityValue = 'disponivel' | 'indisponivel' | 'parcial';

export type AppRole = 'admin' | 'financeiro' | 'funcionario' | 'deposito';

export const PERSON_STATUSES: PersonStatus[] = [
  'ativo',
  'inativo',
  'ferias',
  'afastado',
  'bloqueado',
];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'prevista',
  'presente',
  'falta',
  'substituido',
  'cancelada',
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pendente',
  'aprovado',
  'pago',
  'cancelado',
];

export const AVAILABILITY_PERIODS: AvailabilityPeriod[] = [
  'integral',
  'manha',
  'tarde',
  'noite',
];

export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  ferias: 'Férias',
  afastado: 'Afastado',
  bloqueado: 'Bloqueado',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  prevista: 'Prevista',
  presente: 'Presente',
  falta: 'Falta',
  substituido: 'Substituído',
  cancelada: 'Cancelada',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const PERIOD_LABELS: Record<AvailabilityPeriod, string> = {
  integral: 'Integral',
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export interface PersonRecord {
  id: string;
  name: string;
  social_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  status?: string | null;
  employment_type?: string | null;
  primary_role?: string | null;
  role?: string | null;
  secondary_roles?: string[] | null;
  skills?: string[] | null;
  default_daily_rate?: number | null;
}

export interface SensitiveData {
  cpf?: string | null;
  rg?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_type?: string | null;
  account_holder_name?: string | null;
}

/* ------------------------------------------------------------------ */
/* CPF                                                                 */
/* ------------------------------------------------------------------ */

export const onlyDigits = (value?: string | null): string =>
  (value ?? '').replace(/\D+/g, '');

/** Valida CPF pelos dois dígitos verificadores. Rejeita sequências repetidas. */
export const isValidCPF = (value?: string | null): boolean => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);

  for (const [length, position] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    const check = rest === 10 || rest === 11 ? 0 : rest;
    if (check !== digits[position]) return false;
  }

  return true;
};

/** 123.456.789-09 */
export const formatCPF = (value?: string | null): string => {
  const cpf = onlyDigits(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
};

/**
 * Mascaramento para listas, impressão e mensagens: ***.***.789-**
 * Nunca retorna o CPF completo.
 */
export const maskCPF = (value?: string | null): string => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return cpf ? '***' : '';
  return `***.***.${cpf.slice(6, 9)}-**`;
};

/** Mascara chave PIX / conta bancária mantendo só os 4 últimos caracteres. */
export const maskSensitive = (value?: string | null): string => {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '••••';
  return `••••${raw.slice(-4)}`;
};

/** Remove campos sensíveis de qualquer objeto antes de log/impressão/WhatsApp. */
export const stripSensitive = <T extends Record<string, unknown>>(input: T): Partial<T> => {
  const blocked = new Set([
    'cpf',
    'rg',
    'pix_key',
    'pix_key_type',
    'bank_name',
    'bank_agency',
    'bank_account',
    'bank_account_type',
    'account_holder_name',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!blocked.has(key)) out[key] = value;
  }
  return out as Partial<T>;
};

/* ------------------------------------------------------------------ */
/* Telefone / WhatsApp                                                 */
/* ------------------------------------------------------------------ */

export const formatPhone = (value?: string | null): string => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

export const normalizePhone = (value?: string | null): string => {
  const digits = onlyDigits(value);
  // Remove DDI 55 quando presente para comparação de duplicidade.
  if (digits.length > 11 && digits.startsWith('55')) return digits.slice(-11);
  return digits;
};

/** Link wa.me sem expor dados pessoais na mensagem. */
export const buildWhatsAppLink = (phone?: string | null, message?: string): string | null => {
  const digits = normalizePhone(phone);
  if (digits.length < 10) return null;
  const withDdi = digits.length <= 11 ? `55${digits}` : digits;
  const text = (message ?? '').trim();
  return `https://wa.me/${withDdi}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

/* ------------------------------------------------------------------ */
/* Normalização e status                                               */
/* ------------------------------------------------------------------ */

export const normalizePersonStatus = (value?: string | null): PersonStatus => {
  const raw = (value ?? '').toLowerCase().trim();
  const legacy: Record<string, PersonStatus> = {
    active: 'ativo',
    inactive: 'inativo',
    ativo: 'ativo',
    inativo: 'inativo',
    ferias: 'ferias',
    férias: 'ferias',
    vacation: 'ferias',
    afastado: 'afastado',
    bloqueado: 'bloqueado',
    blocked: 'bloqueado',
  };
  return legacy[raw] ?? 'ativo';
};

export const normalizeEmploymentType = (
  value?: string | null,
  fallback: EmploymentType = 'fixo'
): EmploymentType => {
  const raw = (value ?? '').toLowerCase().trim();
  if (raw === 'fixo' || raw === 'diarista' || raw === 'freelancer') return raw;
  return fallback;
};

/** Só pessoas ativas podem ser escaladas. */
export const isSchedulable = (status?: string | null): boolean =>
  normalizePersonStatus(status) === 'ativo';

export interface DeletionLinks {
  events?: number;
  schedules?: number;
  payments?: number;
}

export interface DeletionGuardResult {
  canDelete: boolean;
  reason?: string;
  suggestion?: 'inativar';
}

/** Impede exclusão acidental de pessoa já ligada a evento, escala ou pagamento. */
export const canDeletePerson = (links: DeletionLinks): DeletionGuardResult => {
  const events = links.events ?? 0;
  const schedules = links.schedules ?? 0;
  const payments = links.payments ?? 0;
  const total = events + schedules + payments;

  if (total === 0) return { canDelete: true };

  const parts: string[] = [];
  if (events) parts.push(`${events} evento(s)`);
  if (schedules) parts.push(`${schedules} escala(s)/diária(s)`);
  if (payments) parts.push(`${payments} pagamento(s)`);

  return {
    canDelete: false,
    reason: `Vinculado a ${parts.join(', ')}. Prefira inativar para preservar o histórico.`,
    suggestion: 'inativar',
  };
};

/* ------------------------------------------------------------------ */
/* Duplicidade                                                         */
/* ------------------------------------------------------------------ */

export const normalizeName = (value?: string | null): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export interface DuplicateCandidate {
  id: string;
  name: string;
  matchedBy: ('cpf' | 'telefone' | 'nome')[];
}

export interface DuplicateInput {
  name?: string | null;
  phone?: string | null;
  cpf?: string | null;
}

export interface ExistingPerson {
  id: string;
  name: string;
  phone?: string | null;
  cpf?: string | null;
}

/**
 * Detecta possíveis duplicados por CPF, telefone ou nome idêntico.
 * NUNCA mescla — apenas devolve candidatos para revisão manual.
 */
export const findDuplicateCandidates = (
  input: DuplicateInput,
  existing: ExistingPerson[],
  ignoreId?: string
): DuplicateCandidate[] => {
  const cpf = onlyDigits(input.cpf);
  const phone = normalizePhone(input.phone);
  const name = normalizeName(input.name);

  const result: DuplicateCandidate[] = [];

  for (const person of existing) {
    if (ignoreId && person.id === ignoreId) continue;

    const matchedBy: DuplicateCandidate['matchedBy'] = [];
    if (cpf && cpf.length === 11 && onlyDigits(person.cpf) === cpf) matchedBy.push('cpf');
    if (phone && phone.length >= 10 && normalizePhone(person.phone) === phone) {
      matchedBy.push('telefone');
    }
    if (name && normalizeName(person.name) === name) matchedBy.push('nome');

    if (matchedBy.length > 0) result.push({ id: person.id, name: person.name, matchedBy });
  }

  return result;
};

/* ------------------------------------------------------------------ */
/* Escala: conflitos e duplicidade no evento                           */
/* ------------------------------------------------------------------ */

export interface ScheduleEntry {
  id?: string;
  personKey: string;
  eventId?: string | null;
  date: string;
  start?: string | null;
  end?: string | null;
}

const toMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [h, m] = time.split(':');
  const hours = Number(h);
  const minutes = Number(m ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export interface ScheduleConflict {
  type: 'duplicidade' | 'horario';
  message: string;
  conflictingId?: string;
}

/**
 * Retorna conflitos ao escalar uma pessoa:
 *  - duplicidade: já escalada no MESMO evento e data;
 *  - horario: intervalos sobrepostos na mesma data em eventos diferentes.
 */
export const detectScheduleConflicts = (
  candidate: ScheduleEntry,
  existing: ScheduleEntry[]
): ScheduleConflict[] => {
  const conflicts: ScheduleConflict[] = [];
  const start = toMinutes(candidate.start);
  const end = toMinutes(candidate.end);

  for (const entry of existing) {
    if (entry.id && candidate.id && entry.id === candidate.id) continue;
    if (entry.personKey !== candidate.personKey) continue;
    if (entry.date !== candidate.date) continue;

    if (candidate.eventId && entry.eventId === candidate.eventId) {
      conflicts.push({
        type: 'duplicidade',
        message: 'Esta pessoa já está escalada neste evento nesta data.',
        conflictingId: entry.id,
      });
      continue;
    }

    const otherStart = toMinutes(entry.start);
    const otherEnd = toMinutes(entry.end);
    if (start === null || end === null || otherStart === null || otherEnd === null) continue;

    if (start < otherEnd && otherStart < end) {
      conflicts.push({
        type: 'horario',
        message: 'Conflito de horário com outra escala nesta data.',
        conflictingId: entry.id,
      });
    }
  }

  return conflicts;
};

/* ------------------------------------------------------------------ */
/* Financeiro da diária                                                */
/* ------------------------------------------------------------------ */

export interface DailyRateBreakdownInput {
  amount?: number | null;
  overtime_amount?: number | null;
  food_amount?: number | null;
  transport_amount?: number | null;
  lodging_amount?: number | null;
  discount_amount?: number | null;
  advances?: number | null;
}

export interface DailyRateBreakdown {
  base: number;
  overtime: number;
  food: number;
  transport: number;
  lodging: number;
  additions: number;
  discount: number;
  advances: number;
  deductions: number;
  gross: number;
  net: number;
}

const money = (value?: number | null): number => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};

const nonNegative = (value?: number | null): number => Math.max(0, money(value));

/** diária + adicionais - descontos - adiantamentos (nunca abaixo de zero). */
export const computeDailyRateTotal = (
  input: DailyRateBreakdownInput
): DailyRateBreakdown => {
  const base = nonNegative(input.amount);
  const overtime = nonNegative(input.overtime_amount);
  const food = nonNegative(input.food_amount);
  const transport = nonNegative(input.transport_amount);
  const lodging = nonNegative(input.lodging_amount);
  const discount = Math.abs(money(input.discount_amount));
  const advances = Math.abs(money(input.advances));

  const additions = money(overtime + food + transport + lodging);
  const gross = money(base + additions);
  const deductions = money(discount + advances);
  const net = money(Math.max(0, gross - deductions));

  return {
    base,
    overtime,
    food,
    transport,
    lodging,
    additions,
    discount,
    advances,
    deductions,
    gross,
    net,
  };
};

/** Transições permitidas do pagamento da diária. */
export const canTransitionPayment = (
  from: PaymentStatus,
  to: PaymentStatus
): boolean => {
  if (from === to) return true;
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    pendente: ['aprovado', 'cancelado', 'pago'],
    aprovado: ['pago', 'cancelado', 'pendente'],
    pago: [],
    cancelado: ['pendente'],
  };
  return allowed[from].includes(to);
};

/* ------------------------------------------------------------------ */
/* Permissões                                                          */
/* ------------------------------------------------------------------ */

const FINANCE_ROLES: AppRole[] = ['admin', 'financeiro'];
const SCHEDULE_ROLES: AppRole[] = ['admin', 'financeiro', 'funcionario'];
const INTERNAL_ROLES: AppRole[] = ['admin', 'financeiro', 'funcionario', 'deposito'];

const hasRole = (role: string | null | undefined, allowed: AppRole[]): boolean =>
  !!role && (allowed as string[]).includes(role);

/** CPF, RG, PIX e dados bancários: só admin e financeiro. */
export const canViewSensitiveData = (role?: string | null): boolean =>
  hasRole(role, FINANCE_ROLES);

export const canEditSensitiveData = (role?: string | null): boolean =>
  hasRole(role, FINANCE_ROLES);

export const canViewFinancials = (role?: string | null): boolean =>
  hasRole(role, FINANCE_ROLES);

export const canManageSchedule = (role?: string | null): boolean =>
  hasRole(role, SCHEDULE_ROLES);

export const canViewPeople = (role?: string | null): boolean =>
  hasRole(role, INTERNAL_ROLES);

export const canDeletePeople = (role?: string | null): boolean =>
  hasRole(role, ['admin']);

/**
 * Projeção segura de uma ficha para perfis sem acesso a dados pessoais:
 * mantém apenas o necessário para escala.
 */
export const projectPersonForRole = (
  person: PersonRecord & SensitiveData,
  role?: string | null
): PersonRecord & Partial<SensitiveData> => {
  if (canViewSensitiveData(role)) return person;
  const safe = stripSensitive(person as unknown as Record<string, unknown>);
  return safe as unknown as PersonRecord;
};
