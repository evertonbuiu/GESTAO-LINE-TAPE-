/**
 * Regras puras de operação e pagamento de diárias (diaristas).
 *
 * Nada aqui toca em rede ou React: apenas funções determinísticas,
 * cobertas por testes em `src/test/people/dailyRates.test.ts`.
 */

import {
  AttendanceStatus,
  PaymentStatus,
  ATTENDANCE_LABELS,
  computeDailyRateTotal,
  DailyRateBreakdown,
  detectScheduleConflicts,
  ScheduleConflict,
} from './people';

/* ------------------------------------------------------------------ */
/* Vínculo estável (worker_id) x fallback legado (worker_name)         */
/* ------------------------------------------------------------------ */

export interface WorkerOption {
  id: string;
  name: string;
  status?: string | null;
  primary_role?: string | null;
  default_daily_rate?: number | null;
  created_at?: string | null;
}

export interface WorkerLink {
  /** ID estável quando a pessoa foi escolhida da lista; null em registros legados. */
  worker_id: string | null;
  /** Sempre preenchido: mantém compatibilidade com todo o histórico por nome. */
  worker_name: string;
  /** true quando o vínculo veio apenas do nome (registro legado). */
  legacy: boolean;
}

const normalize = (value?: string | null): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Resolve o vínculo de um lançamento.
 * - Seleção estável (id informado e existente) => grava worker_id.
 * - Somente nome => tenta casar de forma exata e única; ambiguidade nunca
 *   é resolvida automaticamente (fica legado, para revisão humana).
 * NUNCA faz backfill: apenas decide o que gravar no registro atual.
 */
export const resolveWorkerLink = (
  input: { workerId?: string | null; workerName?: string | null },
  options: WorkerOption[]
): WorkerLink | null => {
  const name = (input.workerName ?? '').trim();

  if (input.workerId) {
    const byId = options.find((o) => o.id === input.workerId);
    if (byId) {
      return { worker_id: byId.id, worker_name: name || byId.name, legacy: false };
    }
  }

  if (!name) return null;

  const matches = options.filter((o) => normalize(o.name) === normalize(name));
  if (matches.length === 1) {
    return { worker_id: matches[0].id, worker_name: name, legacy: false };
  }

  // Sem correspondência ou ambíguo: mantém o histórico por nome.
  return { worker_id: null, worker_name: name, legacy: true };
};

/** Chave usada para agrupar/comparar escalas: prioriza o ID estável. */
export const personKeyOf = (entry: {
  worker_id?: string | null;
  worker_name?: string | null;
}): string => (entry.worker_id ? `id:${entry.worker_id}` : `name:${normalize(entry.worker_name)}`);

/* ------------------------------------------------------------------ */
/* Conflito e duplicidade de lançamento                                */
/* ------------------------------------------------------------------ */

export interface DailyRateEntry {
  id?: string;
  worker_id?: string | null;
  worker_name?: string | null;
  event_id?: string | null;
  date: string;
  planned_start_time?: string | null;
  planned_end_time?: string | null;
}

/**
 * Conflitos ao lançar/editar uma diária:
 *  - duplicidade no mesmo evento e data;
 *  - duplicidade de lançamento avulso (sem evento) no mesmo dia;
 *  - sobreposição de horário previsto na mesma data.
 */
export const detectDailyRateConflicts = (
  candidate: DailyRateEntry,
  existing: DailyRateEntry[]
): ScheduleConflict[] => {
  const key = personKeyOf(candidate);
  const conflicts = detectScheduleConflicts(
    {
      id: candidate.id,
      personKey: key,
      eventId: candidate.event_id ?? null,
      date: candidate.date,
      start: candidate.planned_start_time,
      end: candidate.planned_end_time,
    },
    existing.map((e) => ({
      id: e.id,
      personKey: personKeyOf(e),
      eventId: e.event_id ?? null,
      date: e.date,
      start: e.planned_start_time,
      end: e.planned_end_time,
    }))
  );

  if (!candidate.event_id) {
    const sameDay = existing.find(
      (e) =>
        e.id !== candidate.id &&
        e.date === candidate.date &&
        !e.event_id &&
        personKeyOf(e) === key
    );
    if (sameDay) {
      conflicts.push({
        type: 'duplicidade',
        message: 'Já existe uma diária sem evento para esta pessoa nesta data.',
        conflictingId: sameDay.id,
      });
    }
  }

  return conflicts;
};

/* ------------------------------------------------------------------ */
/* Horários e presença                                                 */
/* ------------------------------------------------------------------ */

const toMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [h, m] = String(time).split(':');
  const hours = Number(h);
  const minutes = Number(m ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

/** Duração em horas; vira o dia quando o fim é menor que o início. */
export const durationInHours = (
  start?: string | null,
  end?: string | null
): number | null => {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return null;
  const diff = e >= s ? e - s : e + 24 * 60 - s;
  return Math.round((diff / 60) * 100) / 100;
};

/** Horas além do previsto (0 quando não houve excedente ou faltam dados). */
export const overtimeHours = (entry: {
  planned_start_time?: string | null;
  planned_end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
}): number => {
  const planned = durationInHours(entry.planned_start_time, entry.planned_end_time);
  const actual = durationInHours(entry.actual_start_time, entry.actual_end_time);
  if (planned === null || actual === null) return 0;
  return Math.max(0, Math.round((actual - planned) * 100) / 100);
};

/** Presenças que não geram pagamento de diária. */
export const isUnpaidAttendance = (status?: string | null): boolean =>
  status === 'falta' || status === 'cancelada';

/** Substituição exige o nome de quem foi substituído. */
export const validateAttendance = (entry: {
  attendance_status?: string | null;
  substituted_worker_name?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
}): string[] => {
  const errors: string[] = [];
  const status = entry.attendance_status;

  if (status === 'substituido' && !(entry.substituted_worker_name ?? '').trim()) {
    errors.push('Informe quem foi substituído.');
  }
  if (status === 'falta' && (entry.actual_start_time || entry.actual_end_time)) {
    errors.push('Falta não pode ter horário real registrado.');
  }
  if (entry.actual_end_time && !entry.actual_start_time) {
    errors.push('Informe o horário real de início.');
  }
  return errors;
};

export const attendanceLabel = (status?: string | null): string =>
  ATTENDANCE_LABELS[(status ?? 'prevista') as AttendanceStatus] ?? String(status);

/* ------------------------------------------------------------------ */
/* Pagamento: memória de cálculo e anti-duplicidade                    */
/* ------------------------------------------------------------------ */

export interface PaymentMemoLine {
  label: string;
  value: number;
  kind: 'base' | 'addition' | 'deduction' | 'total';
}

/** Memória de cálculo exibida e impressa: base + adicionais - descontos. */
export const buildPaymentMemo = (input: {
  amount?: number | null;
  overtime_amount?: number | null;
  food_amount?: number | null;
  transport_amount?: number | null;
  lodging_amount?: number | null;
  discount_amount?: number | null;
  advances?: number | null;
  attendance_status?: string | null;
}): { breakdown: DailyRateBreakdown; lines: PaymentMemoLine[] } => {
  const unpaid = isUnpaidAttendance(input.attendance_status);
  const breakdown = computeDailyRateTotal({
    ...input,
    amount: unpaid ? 0 : input.amount,
    overtime_amount: unpaid ? 0 : input.overtime_amount,
  });

  const allLines: PaymentMemoLine[] = [
    { label: unpaid ? 'Diária (não devida)' : 'Diária base', value: breakdown.base, kind: 'base' },
    { label: 'Hora extra', value: breakdown.overtime, kind: 'addition' },
    { label: 'Alimentação', value: breakdown.food, kind: 'addition' },
    { label: 'Transporte', value: breakdown.transport, kind: 'addition' },
    { label: 'Hospedagem', value: breakdown.lodging, kind: 'addition' },
    { label: 'Desconto', value: breakdown.discount, kind: 'deduction' },
    { label: 'Adiantamentos/Vales', value: breakdown.advances, kind: 'deduction' },
    { label: 'Total a pagar', value: breakdown.net, kind: 'total' },
  ];
  const lines = allLines.filter(
    (line) => line.kind === 'total' || line.kind === 'base' || line.value > 0
  );

  return { breakdown, lines };
};

export interface ExistingTransaction {
  id: string;
  reference_type?: string | null;
  reference_id?: string | null;
  amount?: number | null;
  transaction_date?: string | null;
  bank_account_id?: string | null;
}

/**
 * Impede lançamento financeiro duplicado do pagamento da diária.
 * Considera duplicado quando já existe transação com a mesma referência
 * OU mesma conta + data + valor (tolerância de centavo).
 */
export const findDuplicatePayment = (
  candidate: {
    dailyRateId: string;
    amount: number;
    date: string;
    bank_account_id?: string | null;
  },
  existing: ExistingTransaction[]
): ExistingTransaction | null => {
  const byReference = existing.find(
    (t) => t.reference_type === 'daily_rate' && t.reference_id === candidate.dailyRateId
  );
  if (byReference) return byReference;

  const bySignature = existing.find(
    (t) =>
      !!candidate.bank_account_id &&
      t.bank_account_id === candidate.bank_account_id &&
      t.transaction_date === candidate.date &&
      Math.abs(Number(t.amount ?? 0) - candidate.amount) < 0.01
  );
  return bySignature ?? null;
};

/** Regras de habilitação do pagamento na interface. */
export const canPayDailyRate = (entry: {
  payment_status?: string | null;
  attendance_status?: string | null;
  net?: number;
}): { allowed: boolean; reason?: string } => {
  if (entry.payment_status === 'pago') {
    return { allowed: false, reason: 'Esta diária já está paga.' };
  }
  if (entry.payment_status === 'cancelado') {
    return { allowed: false, reason: 'Diária cancelada: reabra antes de pagar.' };
  }
  if (isUnpaidAttendance(entry.attendance_status) && !(entry.net && entry.net > 0)) {
    return { allowed: false, reason: 'Falta/cancelada sem valores adicionais a pagar.' };
  }
  if ((entry.net ?? 0) <= 0) {
    return { allowed: false, reason: 'Valor líquido zerado.' };
  }
  return { allowed: true };
};

/* ------------------------------------------------------------------ */
/* Relatórios (agregações a partir de dados reais)                     */
/* ------------------------------------------------------------------ */

export interface ReportRate {
  id: string;
  worker_id?: string | null;
  worker_name?: string | null;
  event_id?: string | null;
  event_name?: string | null;
  event_role?: string | null;
  date: string;
  amount?: number | null;
  overtime_amount?: number | null;
  food_amount?: number | null;
  transport_amount?: number | null;
  lodging_amount?: number | null;
  discount_amount?: number | null;
  attendance_status?: string | null;
  payment_status?: string | null;
  planned_start_time?: string | null;
  planned_end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
}

export interface CostGroup {
  key: string;
  label: string;
  days: number;
  absences: number;
  hours: number;
  gross: number;
  deductions: number;
  net: number;
  pending: number;
}

const emptyGroup = (key: string, label: string): CostGroup => ({
  key,
  label,
  days: 0,
  absences: 0,
  hours: 0,
  gross: 0,
  deductions: 0,
  net: 0,
  pending: 0,
});

const round = (value: number): number => Math.round(value * 100) / 100;

/** Agrupa custos reais por evento, profissional ou função. */
export const summarizeCosts = (
  rates: ReportRate[],
  groupBy: 'event' | 'person' | 'role'
): CostGroup[] => {
  const map = new Map<string, CostGroup>();

  for (const rate of rates) {
    let key: string;
    let label: string;
    if (groupBy === 'event') {
      key = rate.event_id ?? 'sem-evento';
      label = rate.event_name ?? (rate.event_id ? 'Evento' : 'Sem evento');
    } else if (groupBy === 'person') {
      key = personKeyOf(rate);
      label = rate.worker_name ?? 'Não informado';
    } else {
      key = (rate.event_role ?? 'sem-funcao').toLowerCase();
      label = rate.event_role ?? 'Sem função';
    }

    const group = map.get(key) ?? emptyGroup(key, label);
    const { breakdown } = buildPaymentMemo(rate);
    const unpaidDay = isUnpaidAttendance(rate.attendance_status);

    group.days += unpaidDay ? 0 : 1;
    group.absences += rate.attendance_status === 'falta' ? 1 : 0;
    group.hours = round(
      group.hours +
        (durationInHours(rate.actual_start_time, rate.actual_end_time) ??
          durationInHours(rate.planned_start_time, rate.planned_end_time) ??
          0)
    );
    group.gross = round(group.gross + breakdown.gross);
    group.deductions = round(group.deductions + breakdown.deductions);
    group.net = round(group.net + breakdown.net);
    if (rate.payment_status !== 'pago' && rate.payment_status !== 'cancelado') {
      group.pending = round(group.pending + breakdown.net);
    }

    map.set(key, group);
  }

  return Array.from(map.values()).sort((a, b) => b.net - a.net);
};

export interface PendingPayment {
  id: string;
  worker_name: string;
  date: string;
  event_name: string | null;
  status: PaymentStatus;
  net: number;
}

/** Lista apenas o que realmente está em aberto (pendente/aprovado). */
export const listPendingPayments = (rates: ReportRate[]): PendingPayment[] =>
  rates
    .filter((r) => r.payment_status === 'pendente' || r.payment_status === 'aprovado')
    .map((r) => ({
      id: r.id,
      worker_name: r.worker_name ?? 'Não informado',
      date: r.date,
      event_name: r.event_name ?? null,
      status: (r.payment_status ?? 'pendente') as PaymentStatus,
      net: buildPaymentMemo(r).breakdown.net,
    }))
    .filter((p) => p.net > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
