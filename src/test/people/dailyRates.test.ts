import { describe, expect, it } from 'vitest';
import {
  attendanceLabel,
  buildPaymentMemo,
  canPayDailyRate,
  detectDailyRateConflicts,
  durationInHours,
  findDuplicatePayment,
  isUnpaidAttendance,
  listPendingPayments,
  overtimeHours,
  personKeyOf,
  resolveWorkerLink,
  summarizeCosts,
  validateAttendance,
  type ReportRate,
  type WorkerOption,
} from '@/lib/dailyRates';

const workers: WorkerOption[] = [
  { id: 'w1', name: 'João da Silva' },
  { id: 'w2', name: 'Maria Souza' },
  { id: 'w3', name: 'João da Silva' },
];

describe('resolveWorkerLink', () => {
  it('grava worker_id quando a seleção é estável', () => {
    const link = resolveWorkerLink({ workerId: 'w2', workerName: 'Maria Souza' }, workers);
    expect(link).toEqual({ worker_id: 'w2', worker_name: 'Maria Souza', legacy: false });
  });

  it('casa por nome único ignorando acentos e caixa', () => {
    const link = resolveWorkerLink({ workerName: 'maria souza' }, workers);
    expect(link?.worker_id).toBe('w2');
    expect(link?.legacy).toBe(false);
  });

  it('mantém legado por nome quando há ambiguidade (nunca mescla sozinho)', () => {
    const link = resolveWorkerLink({ workerName: 'João da Silva' }, workers);
    expect(link).toEqual({ worker_id: null, worker_name: 'João da Silva', legacy: true });
  });

  it('mantém legado quando o nome não existe na base', () => {
    expect(resolveWorkerLink({ workerName: 'Fulano Novo' }, workers)).toEqual({
      worker_id: null,
      worker_name: 'Fulano Novo',
      legacy: true,
    });
  });

  it('retorna null sem nome utilizável', () => {
    expect(resolveWorkerLink({ workerName: '   ' }, workers)).toBeNull();
  });

  it('ignora worker_id inexistente e volta para o nome', () => {
    const link = resolveWorkerLink({ workerId: 'zzz', workerName: 'Maria Souza' }, workers);
    expect(link?.worker_id).toBe('w2');
  });
});

describe('personKeyOf', () => {
  it('prioriza o ID estável', () => {
    expect(personKeyOf({ worker_id: 'w1', worker_name: 'X' })).toBe('id:w1');
  });
  it('normaliza o nome no fallback legado', () => {
    expect(personKeyOf({ worker_name: '  José  ÁLVARO ' })).toBe('name:jose alvaro');
  });
});

describe('detectDailyRateConflicts', () => {
  const existing = [
    {
      id: 'r1',
      worker_id: 'w1',
      date: '2026-08-10',
      event_id: 'e1',
      planned_start_time: '08:00',
      planned_end_time: '12:00',
    },
  ];

  it('acusa duplicidade no mesmo evento e data', () => {
    const conflicts = detectDailyRateConflicts(
      { worker_id: 'w1', date: '2026-08-10', event_id: 'e1' },
      existing
    );
    expect(conflicts.some((c) => c.type === 'duplicidade')).toBe(true);
  });

  it('acusa sobreposição de horário em eventos diferentes', () => {
    const conflicts = detectDailyRateConflicts(
      {
        worker_id: 'w1',
        date: '2026-08-10',
        event_id: 'e2',
        planned_start_time: '11:00',
        planned_end_time: '15:00',
      },
      existing
    );
    expect(conflicts.some((c) => c.type === 'horario')).toBe(true);
  });

  it('acusa duplicidade de diária avulsa no mesmo dia', () => {
    const conflicts = detectDailyRateConflicts(
      { worker_id: 'w1', date: '2026-08-11' },
      [{ id: 'r9', worker_id: 'w1', date: '2026-08-11', event_id: null }]
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictingId).toBe('r9');
  });

  it('não conflita com o próprio registro em edição', () => {
    expect(
      detectDailyRateConflicts(
        { id: 'r1', worker_id: 'w1', date: '2026-08-10', event_id: 'e1' },
        existing
      )
    ).toHaveLength(0);
  });

  it('não conflita entre pessoas diferentes', () => {
    expect(
      detectDailyRateConflicts({ worker_id: 'w2', date: '2026-08-10', event_id: 'e1' }, existing)
    ).toHaveLength(0);
  });
});

describe('horários', () => {
  it('calcula duração simples', () => {
    expect(durationInHours('08:00', '17:30')).toBe(9.5);
  });
  it('vira o dia', () => {
    expect(durationInHours('22:00', '02:00')).toBe(4);
  });
  it('retorna null sem dados', () => {
    expect(durationInHours('08:00', null)).toBeNull();
  });
  it('calcula hora extra apenas quando excede o previsto', () => {
    expect(
      overtimeHours({
        planned_start_time: '08:00',
        planned_end_time: '12:00',
        actual_start_time: '08:00',
        actual_end_time: '14:00',
      })
    ).toBe(2);
    expect(
      overtimeHours({
        planned_start_time: '08:00',
        planned_end_time: '12:00',
        actual_start_time: '08:00',
        actual_end_time: '11:00',
      })
    ).toBe(0);
    expect(overtimeHours({ planned_start_time: '08:00' })).toBe(0);
  });
});

describe('validateAttendance', () => {
  it('exige substituído quando status é substituído', () => {
    expect(validateAttendance({ attendance_status: 'substituido' })).toContain(
      'Informe quem foi substituído.'
    );
  });
  it('bloqueia horário real em falta', () => {
    expect(
      validateAttendance({ attendance_status: 'falta', actual_start_time: '08:00' })
    ).toHaveLength(1);
  });
  it('exige início quando há fim', () => {
    expect(validateAttendance({ actual_end_time: '18:00' })).toHaveLength(1);
  });
  it('aceita presença completa', () => {
    expect(
      validateAttendance({
        attendance_status: 'presente',
        actual_start_time: '08:00',
        actual_end_time: '18:00',
      })
    ).toHaveLength(0);
  });
  it('rotula e identifica presenças não pagas', () => {
    expect(attendanceLabel('falta')).toBeTruthy();
    expect(isUnpaidAttendance('falta')).toBe(true);
    expect(isUnpaidAttendance('presente')).toBe(false);
  });
});

describe('buildPaymentMemo', () => {
  it('soma adicionais e subtrai descontos', () => {
    const { breakdown, lines } = buildPaymentMemo({
      amount: 200,
      overtime_amount: 50,
      food_amount: 30,
      discount_amount: 20,
      advances: 60,
    });
    expect(breakdown.gross).toBe(280);
    expect(breakdown.net).toBe(200);
    expect(lines.at(-1)).toEqual({ label: 'Total a pagar', value: 200, kind: 'total' });
  });

  it('zera a diária base em falta, preservando reembolsos', () => {
    const { breakdown } = buildPaymentMemo({
      amount: 200,
      transport_amount: 40,
      attendance_status: 'falta',
    });
    expect(breakdown.base).toBe(0);
    expect(breakdown.net).toBe(40);
  });

  it('nunca gera líquido negativo', () => {
    expect(buildPaymentMemo({ amount: 100, advances: 500 }).breakdown.net).toBe(0);
  });
});

describe('findDuplicatePayment', () => {
  const candidate = {
    dailyRateId: 'dr1',
    amount: 250,
    date: '2026-08-10',
    bank_account_id: 'acc1',
  };

  it('detecta duplicidade pela referência', () => {
    expect(
      findDuplicatePayment(candidate, [
        { id: 't1', reference_type: 'daily_rate', reference_id: 'dr1' },
      ])?.id
    ).toBe('t1');
  });

  it('detecta duplicidade por conta + data + valor', () => {
    expect(
      findDuplicatePayment(candidate, [
        { id: 't2', bank_account_id: 'acc1', transaction_date: '2026-08-10', amount: 250.004 },
      ])?.id
    ).toBe('t2');
  });

  it('não acusa quando conta ou data divergem', () => {
    expect(
      findDuplicatePayment(candidate, [
        { id: 't3', bank_account_id: 'acc2', transaction_date: '2026-08-10', amount: 250 },
        { id: 't4', bank_account_id: 'acc1', transaction_date: '2026-08-11', amount: 250 },
      ])
    ).toBeNull();
  });
});

describe('canPayDailyRate', () => {
  it('bloqueia diária já paga', () => {
    expect(canPayDailyRate({ payment_status: 'pago', net: 100 }).allowed).toBe(false);
  });
  it('bloqueia cancelada', () => {
    expect(canPayDailyRate({ payment_status: 'cancelado', net: 100 }).allowed).toBe(false);
  });
  it('bloqueia líquido zero', () => {
    expect(canPayDailyRate({ payment_status: 'pendente', net: 0 }).allowed).toBe(false);
  });
  it('permite pendente com valor', () => {
    expect(canPayDailyRate({ payment_status: 'pendente', net: 150 }).allowed).toBe(true);
  });
});

describe('relatórios', () => {
  const rates: ReportRate[] = [
    {
      id: '1',
      worker_id: 'w1',
      worker_name: 'João',
      event_id: 'e1',
      event_name: 'Show A',
      event_role: 'Montagem',
      date: '2026-08-01',
      amount: 200,
      food_amount: 30,
      payment_status: 'pendente',
      actual_start_time: '08:00',
      actual_end_time: '18:00',
    },
    {
      id: '2',
      worker_id: 'w2',
      worker_name: 'Maria',
      event_id: 'e1',
      event_name: 'Show A',
      event_role: 'Montagem',
      date: '2026-08-01',
      amount: 200,
      payment_status: 'pago',
      planned_start_time: '08:00',
      planned_end_time: '12:00',
    },
    {
      id: '3',
      worker_id: 'w1',
      worker_name: 'João',
      date: '2026-08-02',
      amount: 180,
      attendance_status: 'falta',
      payment_status: 'pendente',
    },
  ];

  it('agrupa custo por evento', () => {
    const [showA] = summarizeCosts(rates, 'event');
    expect(showA.label).toBe('Show A');
    expect(showA.gross).toBe(430);
    expect(showA.days).toBe(2);
    expect(showA.pending).toBe(230);
    expect(showA.hours).toBe(14);
  });

  it('agrupa por profissional contando faltas', () => {
    const joao = summarizeCosts(rates, 'person').find((g) => g.label === 'João');
    expect(joao?.days).toBe(1);
    expect(joao?.absences).toBe(1);
    expect(joao?.net).toBe(230);
  });

  it('agrupa por função com rótulo para vazios', () => {
    const labels = summarizeCosts(rates, 'role').map((g) => g.label);
    expect(labels).toContain('Montagem');
    expect(labels).toContain('Sem função');
  });

  it('lista apenas pagamentos realmente em aberto', () => {
    const pending = listPendingPayments(rates);
    expect(pending.map((p) => p.id)).toEqual(['1']);
    expect(pending[0].net).toBe(230);
  });
});
