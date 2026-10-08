import { describe, it, expect } from 'vitest';
import {
  isValidCPF,
  formatCPF,
  maskCPF,
  maskSensitive,
  stripSensitive,
  formatPhone,
  normalizePhone,
  buildWhatsAppLink,
  normalizePersonStatus,
  normalizeEmploymentType,
  isSchedulable,
  canDeletePerson,
  findDuplicateCandidates,
  detectScheduleConflicts,
  computeDailyRateTotal,
  canTransitionPayment,
  canViewSensitiveData,
  canEditSensitiveData,
  canManageSchedule,
  canViewPeople,
  canDeletePeople,
  projectPersonForRole,
} from '@/lib/people';

describe('CPF', () => {
  it('valida CPFs corretos com e sem máscara', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('52998224725')).toBe(true);
    expect(isValidCPF('111.444.777-35')).toBe(true);
  });

  it('rejeita dígitos verificadores errados, tamanho inválido e repetições', () => {
    expect(isValidCPF('529.982.247-26')).toBe(false);
    expect(isValidCPF('123456789')).toBe(false);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('')).toBe(false);
    expect(isValidCPF(null)).toBe(false);
  });

  it('formata progressivamente sem estourar 11 dígitos', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(formatCPF('529982')).toBe('529.982');
    expect(formatCPF('5299822472599')).toBe('529.982.247-25');
  });

  it('mascara CPF sem nunca expor o número completo', () => {
    const masked = maskCPF('529.982.247-25');
    expect(masked).toBe('***.***.247-**');
    expect(masked).not.toContain('529');
    expect(maskCPF('')).toBe('');
  });
});

describe('mascaramento de dados bancários', () => {
  it('mantém apenas os 4 últimos caracteres', () => {
    expect(maskSensitive('12345678')).toBe('••••5678');
    expect(maskSensitive('123')).toBe('••••');
    expect(maskSensitive(null)).toBe('');
  });

  it('remove todos os campos sensíveis antes de log/impressão', () => {
    const out = stripSensitive({
      name: 'João',
      cpf: '52998224725',
      rg: '123',
      pix_key: 'chave',
      bank_account: '999',
      bank_agency: '0001',
      phone: '62999999999',
    });
    expect(out).toEqual({ name: 'João', phone: '62999999999' });
    expect(JSON.stringify(out)).not.toContain('52998224725');
  });
});

describe('telefone e WhatsApp', () => {
  it('formata celular e fixo', () => {
    expect(formatPhone('62999998888')).toBe('(62) 99999-8888');
    expect(formatPhone('6233334444')).toBe('(62) 3333-4444');
  });

  it('normaliza removendo DDI para comparação', () => {
    expect(normalizePhone('+55 (62) 99999-8888')).toBe('62999998888');
  });

  it('gera link wa.me e recusa número curto', () => {
    expect(buildWhatsAppLink('62999998888')).toBe('https://wa.me/5562999998888');
    expect(buildWhatsAppLink('1234')).toBeNull();
  });

  it('não coloca dados sensíveis no link — só a mensagem informada', () => {
    const link = buildWhatsAppLink('62999998888', 'Escala de amanhã confirmada?');
    expect(link).toContain('text=');
    expect(link).not.toContain('529982');
  });
});

describe('status e vínculo', () => {
  it('normaliza status legados', () => {
    expect(normalizePersonStatus('active')).toBe('ativo');
    expect(normalizePersonStatus('inactive')).toBe('inativo');
    expect(normalizePersonStatus('férias')).toBe('ferias');
    expect(normalizePersonStatus(undefined)).toBe('ativo');
  });

  it('normaliza tipo de vínculo com fallback', () => {
    expect(normalizeEmploymentType('diarista')).toBe('diarista');
    expect(normalizeEmploymentType('qualquer', 'diarista')).toBe('diarista');
  });

  it('só permite escalar pessoa ativa', () => {
    expect(isSchedulable('ativo')).toBe(true);
    expect(isSchedulable('ferias')).toBe(false);
    expect(isSchedulable('bloqueado')).toBe(false);
  });
});

describe('proteção contra exclusão', () => {
  it('permite excluir quem não tem vínculo', () => {
    expect(canDeletePerson({}).canDelete).toBe(true);
  });

  it('bloqueia e sugere inativação quando há vínculos', () => {
    const result = canDeletePerson({ events: 2, payments: 1 });
    expect(result.canDelete).toBe(false);
    expect(result.suggestion).toBe('inativar');
    expect(result.reason).toContain('2 evento(s)');
    expect(result.reason).toContain('1 pagamento(s)');
  });
});

describe('duplicidade', () => {
  const existing = [
    { id: 'a', name: 'João da Silva', phone: '62999998888', cpf: '52998224725' },
    { id: 'b', name: 'Maria Souza', phone: '62988887777', cpf: null },
  ];

  it('detecta por CPF', () => {
    const [dup] = findDuplicateCandidates({ name: 'Outro', cpf: '529.982.247-25' }, existing);
    expect(dup.id).toBe('a');
    expect(dup.matchedBy).toContain('cpf');
  });

  it('detecta por telefone com DDI diferente', () => {
    const [dup] = findDuplicateCandidates({ name: 'Outro', phone: '+5562988887777' }, existing);
    expect(dup.id).toBe('b');
    expect(dup.matchedBy).toContain('telefone');
  });

  it('detecta por nome ignorando acento e caixa', () => {
    const [dup] = findDuplicateCandidates({ name: 'joao da silva' }, existing);
    expect(dup.id).toBe('a');
    expect(dup.matchedBy).toContain('nome');
  });

  it('não sugere o próprio registro na edição', () => {
    expect(findDuplicateCandidates({ cpf: '52998224725' }, existing, 'a')).toHaveLength(0);
  });

  it('não mescla nada — apenas devolve candidatos', () => {
    const result = findDuplicateCandidates({ name: 'Ninguém', phone: '11111111111' }, existing);
    expect(result).toEqual([]);
  });
});

describe('conflitos de escala', () => {
  const existing = [
    { id: '1', personKey: 'w1', eventId: 'e1', date: '2026-08-10', start: '08:00', end: '18:00' },
  ];

  it('acusa duplicidade no mesmo evento e data', () => {
    const conflicts = detectScheduleConflicts(
      { personKey: 'w1', eventId: 'e1', date: '2026-08-10' },
      existing
    );
    expect(conflicts[0].type).toBe('duplicidade');
  });

  it('acusa sobreposição de horário em eventos diferentes', () => {
    const conflicts = detectScheduleConflicts(
      { personKey: 'w1', eventId: 'e2', date: '2026-08-10', start: '17:00', end: '22:00' },
      existing
    );
    expect(conflicts[0].type).toBe('horario');
  });

  it('não acusa quando os horários não se sobrepõem', () => {
    const conflicts = detectScheduleConflicts(
      { personKey: 'w1', eventId: 'e2', date: '2026-08-10', start: '18:00', end: '23:00' },
      existing
    );
    expect(conflicts).toHaveLength(0);
  });

  it('não acusa em outra data ou outra pessoa', () => {
    expect(
      detectScheduleConflicts(
        { personKey: 'w1', eventId: 'e1', date: '2026-08-11' },
        existing
      )
    ).toHaveLength(0);
    expect(
      detectScheduleConflicts(
        { personKey: 'w2', eventId: 'e1', date: '2026-08-10' },
        existing
      )
    ).toHaveLength(0);
  });

  it('ignora o próprio registro ao editar', () => {
    expect(
      detectScheduleConflicts(
        { id: '1', personKey: 'w1', eventId: 'e1', date: '2026-08-10' },
        existing
      )
    ).toHaveLength(0);
  });
});

describe('cálculo da diária', () => {
  it('soma diária + adicionais e subtrai descontos/adiantamentos', () => {
    const r = computeDailyRateTotal({
      amount: 200,
      overtime_amount: 50,
      food_amount: 30,
      transport_amount: 20,
      lodging_amount: 100,
      discount_amount: 25,
      advances: 55,
    });
    expect(r.gross).toBe(400);
    expect(r.additions).toBe(200);
    expect(r.deductions).toBe(80);
    expect(r.net).toBe(320);
  });

  it('trata desconto/adiantamento informado como negativo pelo valor absoluto', () => {
    const r = computeDailyRateTotal({ amount: 100, discount_amount: -30, advances: -10 });
    expect(r.net).toBe(60);
  });

  it('nunca devolve líquido negativo', () => {
    const r = computeDailyRateTotal({ amount: 100, advances: 500 });
    expect(r.net).toBe(0);
  });

  it('trata nulos e valores inválidos como zero', () => {
    const r = computeDailyRateTotal({ amount: null, overtime_amount: undefined });
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
  });

  it('arredonda em centavos', () => {
    const r = computeDailyRateTotal({ amount: 100.005, food_amount: 0.1 });
    expect(r.gross).toBe(100.11);
  });
});

describe('transições de pagamento', () => {
  it('permite fluxo pendente → aprovado → pago', () => {
    expect(canTransitionPayment('pendente', 'aprovado')).toBe(true);
    expect(canTransitionPayment('aprovado', 'pago')).toBe(true);
  });

  it('bloqueia qualquer saída de pago', () => {
    expect(canTransitionPayment('pago', 'pendente')).toBe(false);
    expect(canTransitionPayment('pago', 'cancelado')).toBe(false);
    expect(canTransitionPayment('pago', 'pago')).toBe(true);
  });
});

describe('permissões', () => {
  it('só admin e financeiro veem/editam dados sensíveis', () => {
    for (const role of ['admin', 'financeiro']) {
      expect(canViewSensitiveData(role)).toBe(true);
      expect(canEditSensitiveData(role)).toBe(true);
    }
    for (const role of ['funcionario', 'deposito', null, undefined, 'hacker']) {
      expect(canViewSensitiveData(role)).toBe(false);
      expect(canEditSensitiveData(role)).toBe(false);
    }
  });

  it('escala inclui funcionário mas não depósito', () => {
    expect(canManageSchedule('funcionario')).toBe(true);
    expect(canManageSchedule('deposito')).toBe(false);
  });

  it('todos os perfis internos consultam pessoas; só admin exclui', () => {
    expect(canViewPeople('deposito')).toBe(true);
    expect(canViewPeople(null)).toBe(false);
    expect(canDeletePeople('financeiro')).toBe(false);
    expect(canDeletePeople('admin')).toBe(true);
  });

  it('projeta ficha sem dados sensíveis para perfis não autorizados', () => {
    const person = {
      id: '1',
      name: 'João',
      phone: '62999998888',
      cpf: '52998224725',
      pix_key: 'chave-pix',
      bank_account: '9999',
    };
    const safe = projectPersonForRole(person, 'funcionario');
    expect(safe.cpf).toBeUndefined();
    expect((safe as unknown as Record<string, unknown>).pix_key).toBeUndefined();
    expect(safe.name).toBe('João');

    const full = projectPersonForRole(person, 'admin');
    expect(full.cpf).toBe('52998224725');
  });
});
