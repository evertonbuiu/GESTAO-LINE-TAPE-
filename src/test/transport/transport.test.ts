import { describe, it, expect } from 'vitest';
import {
  buildTransportReceiptPath,
  calculateTransportTotals,
  canManageTransports,
  canTransitionTransportStatus,
  canViewTransportValues,
  canViewTransports,
  estimateFuelCostCents,
  emptyTransportForm,
  filterTransports,
  paginateTransports,
  recordToTransportForm,
  sortTransports,
  transportFormToRecord,
  validateTransportForm,
  findTransportConflicts,
  formatCents,
  fromCents,
  getTransportStatusLabel,
  getTransportStatusVariant,
  isCriticalTransportTransition,
  nextTransportStatuses,
  normalizeTransportStatus,
  parseLocalDate,
  summarizeTransports,
  toCents,
  validateTransportDates,
} from '@/lib/transport';

describe('status', () => {
  it('normaliza status legados', () => {
    expect(normalizeTransportStatus('approved')).toBe('completed');
    expect(normalizeTransportStatus('rejected')).toBe('cancelled');
    expect(normalizeTransportStatus('pending')).toBe('planned');
    expect(normalizeTransportStatus(null)).toBe('planned');
    expect(normalizeTransportStatus('in_transit')).toBe('in_transit');
  });

  it('rotula e estiliza status', () => {
    expect(getTransportStatusLabel('in_transit')).toBe('Em trânsito');
    expect(getTransportStatusLabel('pending')).toBe('Pendente');
    expect(getTransportStatusLabel('xyz')).toBe('xyz');
    expect(getTransportStatusVariant('cancelled')).toBe('cancelled');
    expect(getTransportStatusVariant('completed')).toBe('confirmed');
  });

  it('permite apenas transições válidas', () => {
    expect(canTransitionTransportStatus('planned', 'in_transit')).toBe(true);
    expect(canTransitionTransportStatus('planned', 'completed')).toBe(false);
    expect(canTransitionTransportStatus('in_transit', 'completed')).toBe(true);
    expect(canTransitionTransportStatus('completed', 'planned')).toBe(false);
    expect(canTransitionTransportStatus('cancelled', 'in_transit')).toBe(false);
    expect(canTransitionTransportStatus('planned', 'invalido')).toBe(false);
    expect(nextTransportStatuses('planned')).toEqual(['in_transit', 'cancelled']);
    expect(nextTransportStatuses('completed')).toEqual([]);
  });

  it('marca transições críticas', () => {
    expect(isCriticalTransportTransition('completed')).toBe(true);
    expect(isCriticalTransportTransition('cancelled')).toBe(true);
    expect(isCriticalTransportTransition('in_transit')).toBe(false);
  });
});

describe('datas', () => {
  it('interpreta datas sem deslocamento de fuso', () => {
    const d = parseLocalDate('2026-03-10')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(10);
    expect(parseLocalDate('')).toBeNull();
  });

  it('valida coerência das datas', () => {
    expect(validateTransportDates({ transport_date: '2026-03-10' })).toEqual([]);
    expect(validateTransportDates({})).toHaveLength(1);
    expect(
      validateTransportDates({ transport_date: '2026-03-10', arrival_date: '2026-03-09' }),
    ).toContain('A data de chegada não pode ser anterior à data de saída.');
    expect(
      validateTransportDates({ transport_date: '2026-03-10', expected_return_date: '2026-03-01' }),
    ).toContain('A data de retorno não pode ser anterior à data de saída.');
    expect(
      validateTransportDates({
        transport_date: '2026-03-10',
        arrival_date: '2026-03-12',
        expected_return_date: '2026-03-11',
      }),
    ).toContain('A data de retorno não pode ser anterior à chegada.');
  });
});

describe('conflitos de agenda', () => {
  const base = [
    {
      id: 'a',
      status: 'planned',
      vehicle_plate: 'abc-1234',
      driver_name: 'João Silva',
      transport_date: '2026-03-10',
      expected_return_date: '2026-03-14',
    },
    {
      id: 'b',
      status: 'cancelled',
      vehicle_plate: 'XYZ-9999',
      driver_name: 'Maria',
      transport_date: '2026-03-10',
      expected_return_date: '2026-03-14',
    },
  ];

  it('detecta conflito de veículo ignorando caixa', () => {
    const conflicts = findTransportConflicts(
      { vehicle_plate: 'ABC-1234', driver_name: 'Outro', transport_date: '2026-03-12' },
      base,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe('vehicle');
  });

  it('detecta conflito de motorista', () => {
    const conflicts = findTransportConflicts(
      { vehicle_plate: 'ZZZ-0000', driver_name: 'joão silva', transport_date: '2026-03-11' },
      base,
    );
    expect(conflicts[0].reason).toBe('driver');
  });

  it('ignora cancelados, o próprio registro e períodos sem sobreposição', () => {
    expect(
      findTransportConflicts(
        { vehicle_plate: 'XYZ-9999', driver_name: 'Maria', transport_date: '2026-03-11' },
        base,
      ),
    ).toEqual([]);
    expect(
      findTransportConflicts(
        { id: 'a', vehicle_plate: 'ABC-1234', driver_name: 'João Silva', transport_date: '2026-03-11' },
        base,
      ),
    ).toEqual([]);
    expect(
      findTransportConflicts(
        { vehicle_plate: 'ABC-1234', driver_name: 'João Silva', transport_date: '2026-04-01' },
        base,
      ),
    ).toEqual([]);
  });
});

describe('cálculos monetários', () => {
  it('converte reais em centavos com arredondamento seguro', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents('1,50')).toBe(150);
    expect(toCents(null)).toBe(0);
    expect(toCents('abc')).toBe(0);
    expect(fromCents(12345)).toBe(123.45);
    expect(formatCents(12345)).toContain('123,45');
  });

  it('estima combustível por consumo e preço', () => {
    expect(estimateFuelCostCents({ distance_km: 600, fuel_consumption_kmpl: 8, fuel_price_cents: 600 })).toBe(45000);
    expect(estimateFuelCostCents({ distance_km: 600, fuel_consumption_kmpl: 0, fuel_price_cents: 600 })).toBe(0);
    expect(estimateFuelCostCents({})).toBe(0);
  });

  it('soma custos, margem e saldo de adiantamento', () => {
    const totals = calculateTransportTotals({
      distance_km: 600,
      fuel_consumption_kmpl: 8,
      fuel_price_cents: 600,
      toll_cents: 5000,
      lodging_cents: 10000,
      meals_cents: 5000,
      daily_rate_cents: 20000,
      maintenance_cents: 0,
      freight_cents: 0,
      extra_cents: 1000,
      advance_cents: 30000,
      revenue_cents: 120000,
    });
    expect(totals.fuelCents).toBe(45000);
    expect(totals.totalCostCents).toBe(86000);
    expect(totals.marginCents).toBe(34000);
    expect(totals.marginPercent).toBeCloseTo(28.33, 2);
    expect(totals.balanceCents).toBe(56000);
    expect(totals.costPerKmCents).toBe(143);
  });

  it('ignora valores negativos e usa custo informado quando existir', () => {
    const totals = calculateTransportTotals({ fuel_cost_cents: 1000, toll_cents: -500, revenue_cents: -10 });
    expect(totals.totalCostCents).toBe(1000);
    expect(totals.revenueCents).toBe(0);
    expect(totals.marginPercent).toBe(0);
  });

  it('resume a frota ignorando cancelados nos totais', () => {
    const summary = summarizeTransports([
      { status: 'completed', fuel_cost_cents: 1000, revenue_cents: 5000 },
      { status: 'cancelled', fuel_cost_cents: 9999, revenue_cents: 9999 },
      { status: 'in_transit', fuel_cost_cents: 500, revenue_cents: 1000 },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.activeCount).toBe(2);
    expect(summary.totalCostCents).toBe(1500);
    expect(summary.revenueCents).toBe(6000);
    expect(summary.marginCents).toBe(4500);
    expect(summary.inTransit).toBe(1);
    expect(summary.completed).toBe(1);
  });
});

describe('permissões e anexos', () => {
  it('respeita papéis de leitura, escrita e valores', () => {
    expect(canViewTransports('funcionario')).toBe(true);
    expect(canViewTransports('anon')).toBe(false);
    expect(canManageTransports('deposito')).toBe(true);
    expect(canManageTransports('financeiro')).toBe(false);
    expect(canViewTransportValues('financeiro')).toBe(true);
    expect(canViewTransportValues('deposito')).toBe(false);
  });

  it('gera caminho privado com prefixo do próprio usuário', () => {
    const path = buildTransportReceiptPath('11111111-1111-1111-1111-111111111111', 'Recibo Final.PDF', 1700000000000);
    expect(path).toBe('interstate-transports/11111111-1111-1111-1111-111111111111-1700000000000.pdf');
    expect(path.startsWith('interstate-transports/')).toBe(true);
    expect(path).not.toContain('..');
  });
});

describe('busca e filtros', () => {
  const items = [
    { status: 'planned', destination: 'SP', origin_state: 'GO', driver_name: 'João', vehicle_plate: 'ABC-1234', invoice_number: '100', cargo_type: 'Som' },
    { status: 'completed', destination: 'RJ', origin_state: 'GO', driver_name: 'Maria', vehicle_plate: 'XYZ-9999', invoice_number: '200', cargo_type: 'Luz' },
  ];

  it('filtra por termo e status', () => {
    expect(filterTransports(items, { search: 'maria' })).toHaveLength(1);
    expect(filterTransports(items, { search: 'abc' })).toHaveLength(1);
    expect(filterTransports(items, { status: 'completed' })).toHaveLength(1);
    expect(filterTransports(items, {})).toHaveLength(2);
    expect(filterTransports(items, { search: 'inexistente' })).toHaveLength(0);
  });
});

describe('ordenação e paginação', () => {
  const base = { destination: 'X', driver_name: 'A', vehicle_plate: 'AAA1A11', status: 'planned' };
  const items = [
    { ...base, id: '1', transport_date: '2026-01-10', freight_cents: 1000 },
    { ...base, id: '2', transport_date: '2026-03-10', freight_cents: 5000 },
    { ...base, id: '3', transport_date: '2026-02-10', freight_cents: 3000 },
  ];

  it('ordena por data e por custo', () => {
    expect(sortTransports(items, 'transport_date', 'asc').map((i) => i.id)).toEqual(['1', '3', '2']);
    expect(sortTransports(items, 'cost', 'desc').map((i) => i.id)).toEqual(['2', '3', '1']);
  });

  it('pagina respeitando limites', () => {
    const page1 = paginateTransports(items, 1, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    const page9 = paginateTransports(items, 9, 2);
    expect(page9.page).toBe(2);
    expect(page9.items).toHaveLength(1);
  });
});

describe('formulário de transporte', () => {
  const form = {
    ...emptyTransportForm,
    transport_date: '2026-05-01',
    departure_time: '08:30',
    destination: 'São Paulo',
    destination_state: 'SP',
    origin_city: 'Goiânia',
    origin_state: 'GO',
    driver_name: 'João',
    vehicle_plate: 'abc1d23',
    vehicle_capacity_kg: 1000,
    cargo_weight: 500,
    distance_km: 900,
    fuel_consumption_kmpl: 3,
    fuel_price: 6,
    toll: 120.5,
    advance: 100,
    revenue: 4000,
    legs: [{ from: 'Goiânia', to: 'Uberlândia', km: 400 }, { from: '', to: '', km: 0 }],
    helpers: ['Pedro', '  '],
  };

  it('converte formulário em registro com centavos e normalizações', () => {
    const record: any = transportFormToRecord(form, { userId: 'user-1' });
    expect(record.vehicle_plate).toBe('ABC1D23');
    expect(record.toll_cents).toBe(12050);
    expect(record.advance_cents).toBe(10000);
    expect(record.revenue_cents).toBe(400000);
    expect(record.fuel_cost_cents).toBe(180000);
    expect(record.legs).toHaveLength(1);
    expect(record.helpers).toEqual(['Pedro']);
    expect(record.arrival_time).toBeNull();
    expect(record.status).toBe('planned');
    expect(record.created_by).toBe('user-1');
  });

  it('faz round-trip registro -> formulário', () => {
    const record = transportFormToRecord(form, { userId: 'user-1' });
    const back = recordToTransportForm(record as any);
    expect(back.toll).toBeCloseTo(120.5, 2);
    expect(back.revenue).toBeCloseTo(4000, 2);
    expect(back.destination_state).toBe('SP');
    expect(back.helpers).toEqual(['Pedro']);
  });

  it('valida obrigatórios, negativos e capacidade', () => {
    expect(validateTransportForm(form)).toEqual([]);
    const invalid = validateTransportForm({ ...form, destination: '', cargo_weight: 5000, revenue: -1 });
    expect(invalid.some((e) => e.includes('destino'))).toBe(true);
    expect(invalid.some((e) => e.includes('capacidade'))).toBe(true);
    expect(invalid.some((e) => e.includes('negativos'))).toBe(true);
  });
});
