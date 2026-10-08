import { describe, it, expect } from 'vitest';
import {
  RENTAL_STATUSES,
  rentalStatusLabel,
  nextRentalStatuses,
  canTransitionRentalStatus,
  isCriticalRentalTransition,
  parseLocalDate,
  toLocalDateString,
  validateRentalDates,
  rentalDays,
  detectScheduleConflicts,
  computeAvailableQuantity,
  validateReservation,
  computeRentalTotals,
  roundCurrency,
  computePaymentSummary,
  filterRentals,
  sortRentals,
  paginate,
  canEditRentals,
  canDeleteRentals,
  canViewRentalValues,
  canManageEquipmentAllocation,
} from '@/lib/rentals';

describe('status de locações', () => {
  it('expõe todos os status conhecidos com rótulo em português', () => {
    expect(RENTAL_STATUSES).toHaveLength(5);
    expect(rentalStatusLabel('in_progress')).toBe('Em Andamento');
    expect(rentalStatusLabel('desconhecido')).toBe('desconhecido');
  });

  it('permite apenas transições válidas', () => {
    expect(canTransitionRentalStatus('pending', 'confirmed')).toBe(true);
    expect(canTransitionRentalStatus('pending', 'completed')).toBe(false);
    expect(canTransitionRentalStatus('confirmed', 'in_progress')).toBe(true);
    expect(canTransitionRentalStatus('in_progress', 'completed')).toBe(true);
  });

  it('trata concluído e cancelado como terminais', () => {
    expect(nextRentalStatuses('completed')).toEqual([]);
    expect(nextRentalStatuses('cancelled')).toEqual([]);
    expect(canTransitionRentalStatus('completed', 'pending')).toBe(false);
  });

  it('não permite transição para o mesmo status', () => {
    expect(canTransitionRentalStatus('pending', 'pending')).toBe(false);
  });

  it('marca cancelamento e conclusão como ações críticas', () => {
    expect(isCriticalRentalTransition('cancelled')).toBe(true);
    expect(isCriticalRentalTransition('completed')).toBe(true);
    expect(isCriticalRentalTransition('confirmed')).toBe(false);
  });
});

describe('datas', () => {
  it('interpreta YYYY-MM-DD sem shift de fuso', () => {
    const d = parseLocalDate('2026-03-01')!;
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(2);
    expect(toLocalDateString(d)).toBe('2026-03-01');
  });

  it('rejeita valores inválidos', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('01/03/2026')).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
  });

  it('valida montagem anterior ao evento', () => {
    expect(validateRentalDates({ event_date: '2026-03-10', setup_start_date: '2026-03-09' }).valid).toBe(true);
    const bad = validateRentalDates({ event_date: '2026-03-10', setup_start_date: '2026-03-12' });
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toMatch(/montagem/i);
  });

  it('exige data do evento e valida devolução', () => {
    expect(validateRentalDates({}).valid).toBe(false);
    expect(validateRentalDates({ event_date: '2026-03-10', end_date: '2026-03-09' }).valid).toBe(false);
    expect(validateRentalDates({ event_date: '2026-03-10', end_date: '2026-03-12' }).valid).toBe(true);
  });

  it('conta diárias inclusivas com mínimo de 1', () => {
    expect(rentalDays('2026-03-10', '2026-03-10')).toBe(1);
    expect(rentalDays('2026-03-10', '2026-03-12')).toBe(3);
    expect(rentalDays('2026-03-10')).toBe(1);
    expect(rentalDays(null)).toBe(0);
  });
});

describe('conflitos de agenda', () => {
  const base = [
    { id: 'a', name: 'Show A', status: 'confirmed', location: 'Arena Goiânia', event_date: '2026-03-10' },
    { id: 'b', name: 'Show B', status: 'cancelled', location: 'Arena Goiânia', event_date: '2026-03-10' },
    { id: 'c', name: 'Show C', status: 'pending', location: 'Centro de Convenções', event_date: '2026-03-10' },
  ];

  it('detecta conflito forte no mesmo local e data', () => {
    const found = detectScheduleConflicts(
      { id: 'novo', location: 'arena goiania', event_date: '2026-03-10' },
      base,
    );
    expect(found.some((f) => f.rental.id === 'a' && f.severity === 'conflict')).toBe(true);
  });

  it('ignora locações canceladas', () => {
    const found = detectScheduleConflicts({ id: 'novo', location: 'Arena Goiânia', event_date: '2026-03-10' }, base);
    expect(found.find((f) => f.rental.id === 'b')).toBeUndefined();
  });

  it('avisa sobre sobreposição em locais diferentes', () => {
    const found = detectScheduleConflicts({ id: 'novo', location: 'Arena Goiânia', event_date: '2026-03-10' }, base);
    expect(found.find((f) => f.rental.id === 'c')?.severity).toBe('warning');
  });

  it('considera período de montagem na sobreposição', () => {
    const found = detectScheduleConflicts(
      { id: 'novo', location: 'Arena Goiânia', setup_start_date: '2026-03-08', event_date: '2026-03-12' },
      base,
    );
    expect(found.some((f) => f.rental.id === 'a')).toBe(true);
  });

  it('não conflita quando não há sobreposição', () => {
    expect(
      detectScheduleConflicts({ id: 'novo', location: 'Arena Goiânia', event_date: '2026-04-10' }, base),
    ).toEqual([]);
  });
});

describe('estoque e reservas', () => {
  const stock = { name: 'Moving Head', total_stock: 10 };
  const allocations = [
    { equipment_name: 'Moving Head', quantity: 4, status: 'confirmed', event_id: 'e1' },
    { equipment_name: 'Moving Head', quantity: 2, status: 'returned', event_id: 'e2' },
    { equipment_name: 'Refletor', quantity: 5, status: 'pending', event_id: 'e3' },
  ];

  it('devolvidos liberam estoque', () => {
    expect(computeAvailableQuantity(stock, allocations)).toBe(6);
  });

  it('pode ignorar alocações do próprio evento em edição', () => {
    expect(computeAvailableQuantity(stock, allocations, { ignoreEventId: 'e1' })).toBe(10);
  });

  it('impede dupla reserva acima do disponível', () => {
    const result = validateReservation({ stock, allocations, quantity: 7 });
    expect(result.valid).toBe(false);
    expect(result.available).toBe(6);
    expect(result.errors[0]).toMatch(/indispon/i);
  });

  it('aceita reserva dentro do disponível', () => {
    expect(validateReservation({ stock, allocations, quantity: 6 }).valid).toBe(true);
  });

  it('considera a quantidade atual ao editar uma alocação existente', () => {
    const result = validateReservation({ stock, allocations, quantity: 8, currentQuantity: 4 });
    expect(result.valid).toBe(true);
    expect(result.available).toBe(10);
  });

  it('rejeita quantidades inválidas e itens inexistentes', () => {
    expect(validateReservation({ stock, allocations, quantity: 0 }).valid).toBe(false);
    expect(validateReservation({ stock, allocations, quantity: 1.5 }).valid).toBe(false);
    expect(validateReservation({ stock: undefined, allocations, quantity: 1 }).valid).toBe(false);
  });
});

describe('cálculos monetários', () => {
  it('arredonda em centavos de forma estável', () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it('calcula subtotal por diária x quantidade x dias', () => {
    const t = computeRentalTotals({ dailyRate: 150, quantity: 4, days: 3 });
    expect(t.subtotal).toBe(1800);
    expect(t.total).toBe(1800);
  });

  it('aplica desconto percentual e em valor', () => {
    const t = computeRentalTotals({ dailyRate: 100, quantity: 1, days: 10, discountPercentage: 10, discountAmount: 50 });
    expect(t.discount).toBe(150);
    expect(t.total).toBe(850);
  });

  it('nunca deixa o desconto superar o subtotal', () => {
    const t = computeRentalTotals({ dailyRate: 100, quantity: 1, days: 1, discountAmount: 500 });
    expect(t.discount).toBe(100);
    expect(t.total).toBe(0);
  });

  it('soma frete e adicionais na base tributável', () => {
    const t = computeRentalTotals({ dailyRate: 100, quantity: 1, days: 1, freight: 200, extras: 50 });
    expect(t.taxableBase).toBe(350);
    expect(t.total).toBe(350);
  });

  it('calcula imposto por dentro', () => {
    const t = computeRentalTotals({ dailyRate: 1000, quantity: 1, days: 1, taxPercentage: 5 });
    expect(t.tax).toBe(52.63);
    expect(t.total).toBe(1052.63);
  });

  it('mantém a caução fora do total do serviço', () => {
    const t = computeRentalTotals({ dailyRate: 500, quantity: 1, days: 1, deposit: 300 });
    expect(t.total).toBe(500);
    expect(t.totalWithDeposit).toBe(800);
  });
});

describe('resumo de pagamento', () => {
  it('reporta pendente quando nada foi pago', () => {
    const s = computePaymentSummary({ total_budget: 1000, is_paid: false });
    expect(s.status).toBe('pendente');
    expect(s.remaining).toBe(1000);
  });

  it('reporta parcial e calcula o restante da entrada', () => {
    const s = computePaymentSummary({
      total_budget: 1000,
      is_paid: true,
      payment_type: 'entrada',
      payment_amount: 400,
    });
    expect(s.status).toBe('parcial');
    expect(s.paid).toBe(400);
    expect(s.remaining).toBe(600);
  });

  it('reporta pago quando entrada + restante quitam o total', () => {
    const s = computePaymentSummary({
      total_budget: 1000,
      is_paid: true,
      payment_type: 'entrada',
      payment_amount: 400,
      is_remaining_paid: true,
      remaining_payment_amount: 600,
    });
    expect(s.status).toBe('pago');
    expect(s.remaining).toBe(0);
  });

  it('considera pagamento total sem valor informado como integral', () => {
    const s = computePaymentSummary({ total_budget: 1000, is_paid: true, payment_type: 'total' });
    expect(s.status).toBe('pago');
    expect(s.remaining).toBe(0);
  });
});

describe('busca, filtros, ordenação e paginação', () => {
  const rentals = [
    { id: '1', name: 'Festival Sertanejo', client_name: 'Prefeitura', location: 'Goiânia', event_date: '2026-03-10', status: 'confirmed', total_budget: 5000, is_paid: false },
    { id: '2', name: 'Casamento Ana', client_name: 'Ana Souza', location: 'Anápolis', event_date: '2026-04-02', status: 'pending', total_budget: 1200, is_paid: true, payment_type: 'entrada', payment_amount: 600 },
    { id: '3', name: 'Show Rock', client_name: 'Produtora X', location: 'Goiânia', event_date: '2026-02-01', status: 'cancelled', total_budget: 900, is_paid: false },
  ];

  it('busca sem acento e sem case', () => {
    expect(filterRentals(rentals, { search: 'goiania' }).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('filtra por status e por período', () => {
    expect(filterRentals(rentals, { status: 'pending' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRentals(rentals, { from: '2026-03-01', to: '2026-04-30' }).map((r) => r.id)).toEqual(['1', '2']);
  });

  it('filtra por situação de pagamento', () => {
    expect(filterRentals(rentals, { paymentStatus: 'parcial' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRentals(rentals, { paymentStatus: 'pendente' }).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('ordena por data e por valor', () => {
    expect(sortRentals(rentals, 'event_date', 'asc').map((r) => r.id)).toEqual(['3', '1', '2']);
    expect(sortRentals(rentals, 'total_budget', 'desc').map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('não muta o array original', () => {
    const copy = [...rentals];
    sortRentals(rentals, 'name', 'asc');
    expect(rentals).toEqual(copy);
  });

  it('pagina com limites seguros', () => {
    const page = paginate(rentals, 5, 2);
    expect(page.page).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });
});

describe('permissões', () => {
  it('restringe edição e exclusão por papel', () => {
    expect(canEditRentals('admin')).toBe(true);
    expect(canEditRentals('financeiro')).toBe(true);
    expect(canEditRentals('funcionario')).toBe(false);
    expect(canDeleteRentals('financeiro')).toBe(false);
    expect(canDeleteRentals('admin')).toBe(true);
  });

  it('esconde valores de papéis operacionais', () => {
    expect(canViewRentalValues('funcionario')).toBe(false);
    expect(canViewRentalValues('deposito')).toBe(false);
    expect(canViewRentalValues('admin')).toBe(true);
  });

  it('permite depósito gerenciar alocação de equipamentos', () => {
    expect(canManageEquipmentAllocation('deposito')).toBe(true);
    expect(canManageEquipmentAllocation('funcionario')).toBe(false);
  });
});
