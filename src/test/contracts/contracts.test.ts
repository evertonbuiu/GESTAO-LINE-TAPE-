import { describe, it, expect } from 'vitest';
import {
  CONTRACT_TEMPLATE_VERSION,
  ContractRecord,
  allowedTransitions,
  buildContractPrintDocument,
  buildDuplicate,
  buildWhatsAppLink,
  canTransition,
  cloneDefaultSections,
  computeFinancials,
  computeItemsSubtotal,
  emptyDetails,
  formatCurrency,
  formatDateBR,
  hydrateContract,
  isContentLocked,
  isValidDocument,
  isValidPhone,
  nextContractNumber,
  normalizeStatus,
  validateContract,
} from '@/lib/contracts';

function completeDraft() {
  const details = emptyDetails();
  details.parties = {
    companyName: 'Letra 3D line tape Iluminação LTDA',
    companyDocument: '42.089.948/0001-05',
    companyAddress: 'Rua X, 100 — Goiânia/GO',
    companyPhone: '(62) 3333-3333',
    companyEmail: 'contato@linetape.com',
    companyRepresentative: 'Responsável Legal',
    clientAddress: 'Av. Y, 200 — Goiânia/GO',
    technicalResponsible: 'Técnico',
  };
  details.event = {
    name: 'Casamento',
    date: '2026-09-10',
    startTime: '18:00',
    endTime: '23:00',
    setupDate: '2026-09-09',
    location: 'Espaço Alfa',
    city: 'Goiânia/GO',
  };
  details.items = [
    { id: 'i1', name: 'Refletor LED', quantity: 10, unitPrice: 100, subtotal: 1000 },
  ];
  details.financials.downPayment = 500;
  details.financials.installments = [
    { id: 'p1', label: 'Parcela 1', dueDate: '2026-09-08', amount: 500 },
  ];
  details.signature.place = 'Goiânia/GO';

  return {
    contract_number: 'CTR-20260810-001',
    client_name: 'Cliente Teste',
    client_document: '123.456.789-09',
    client_phone: '(62) 99999-9999',
    service_description: 'Locação de iluminação cênica',
    start_date: '2026-09-09',
    end_date: '2026-09-11',
    total_value: 1000,
    details,
    sections_snapshot: cloneDefaultSections(),
  };
}

describe('validação do contrato', () => {
  it('não aponta pendências em um contrato completo', () => {
    expect(validateContract(completeDraft())).toEqual([]);
  });

  it('bloqueia contratante sem documento, telefone e endereço', () => {
    const draft = completeDraft();
    draft.client_document = '123';
    draft.client_phone = '';
    draft.details.parties.clientAddress = '';
    const fields = validateContract(draft).map((i) => i.field);
    expect(fields).toContain('client_document');
    expect(fields).toContain('client_phone');
    expect(fields).toContain('clientAddress');
  });

  it('exige data/local do evento e vigência coerente', () => {
    const draft = completeDraft();
    draft.details.event.date = '';
    draft.details.event.location = '';
    draft.end_date = '2026-09-01';
    const fields = validateContract(draft).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['eventDate', 'eventLocation', 'end_date']));
  });

  it('exige forma de pagamento (sinal ou parcelas)', () => {
    const draft = completeDraft();
    draft.details.financials.downPayment = 0;
    draft.details.financials.installments = [];
    expect(validateContract(draft).map((i) => i.field)).toContain('payment');
  });

  it('exige duas testemunhas válidas quando configurado', () => {
    const draft = completeDraft();
    draft.details.signature.requireWitnesses = true;
    expect(validateContract(draft).map((i) => i.field)).toContain('witnesses');

    draft.details.witnesses = [
      { name: 'A', document: '123.456.789-09' },
      { name: 'B', document: '123' },
    ];
    expect(validateContract(draft).map((i) => i.field)).toContain('witness_1');
  });

  it('valida CPF/CNPJ pelo tamanho e telefone', () => {
    expect(isValidDocument('123.456.789-09')).toBe(true);
    expect(isValidDocument('42.089.948/0001-05')).toBe(true);
    expect(isValidDocument('123')).toBe(false);
    expect(isValidPhone('(62) 99999-9999')).toBe(true);
    expect(isValidPhone('999')).toBe(false);
  });
});

describe('cálculo financeiro', () => {
  it('soma itens, aplica desconto e adicionais', () => {
    const details = emptyDetails();
    details.items = [
      { id: 'a', name: 'A', quantity: 2, unitPrice: 100, subtotal: 200 },
      { id: 'b', name: 'B', quantity: 1, unitPrice: 50, subtotal: 50 },
    ];
    details.financials = {
      ...details.financials,
      discount: 25,
      travel: 100,
      lodging: 75,
      taxes: 10,
    };
    const result = computeFinancials(details);
    expect(result.itemsSubtotal).toBe(250);
    expect(result.total).toBe(410);
  });

  it('sinaliza divergência entre total e sinal + parcelas', () => {
    const details = emptyDetails();
    details.items = [{ id: 'a', name: 'A', quantity: 1, unitPrice: 1000, subtotal: 1000 }];
    details.financials.downPayment = 400;
    details.financials.installments = [
      { id: 'p', label: 'P1', dueDate: '2026-01-01', amount: 300 },
    ];
    const result = computeFinancials(details);
    expect(result.scheduledTotal).toBe(700);
    expect(result.hasScheduleMismatch).toBe(true);
    expect(result.scheduleMismatch).toBe(300);
    expect(result.balance).toBe(600);
  });

  it('não alerta quando não há agendamento informado', () => {
    const details = emptyDetails();
    details.items = [{ id: 'a', name: 'A', quantity: 1, unitPrice: 500, subtotal: 500 }];
    expect(computeFinancials(details).hasScheduleMismatch).toBe(false);
  });

  it('calcula subtotal a partir de quantidade × unitário quando ausente', () => {
    expect(
      computeItemsSubtotal([{ id: 'a', name: 'A', quantity: 3, unitPrice: 25, subtotal: 0 }]),
    ).toBe(75);
  });
});

describe('status, imutabilidade e legado', () => {
  it('converte status legados sem gravar no banco', () => {
    expect(normalizeStatus('draft')).toBe('rascunho');
    expect(normalizeStatus('active')).toBe('enviado');
    expect(normalizeStatus('completed')).toBe('assinado');
    expect(normalizeStatus('cancelled')).toBe('cancelado');
    expect(normalizeStatus(null)).toBe('rascunho');
    expect(normalizeStatus('assinado')).toBe('assinado');
  });

  it('permite apenas transições válidas', () => {
    expect(canTransition('rascunho', 'enviado')).toBe(true);
    expect(canTransition('enviado', 'assinado')).toBe(true);
    expect(canTransition('assinado', 'rascunho')).toBe(false);
    expect(allowedTransitions('assinado')).toEqual(['cancelado']);
    expect(allowedTransitions('cancelado')).toEqual([]);
  });

  it('trava conteúdo por status assinado ou pela flag locked', () => {
    expect(isContentLocked({ status: 'assinado', locked: false })).toBe(true);
    expect(isContentLocked({ status: 'cancelado', locked: true })).toBe(true);
    expect(isContentLocked({ status: 'rascunho', locked: false })).toBe(false);
    // contrato legado "completed" equivale a assinado
    expect(isContentLocked({ status: 'completed', locked: null })).toBe(true);
  });

  it('hidrata contratos legados sem details/snapshot', () => {
    const hydrated = hydrateContract({
      id: '1',
      contract_number: 'CTR-1',
      client_name: 'Antigo',
      status: 'draft',
      total_value: '150.5',
    });
    expect(hydrated.total_value).toBe(150.5);
    expect(hydrated.sections_snapshot?.length).toBeGreaterThan(0);
    expect(hydrated.details?.parties.companyName).toBe('');
    expect(hydrated.details?.items).toEqual([]);
  });
});

describe('versionamento e duplicação', () => {
  it('duplica como novo rascunho destravado preservando o snapshot', () => {
    const original = hydrateContract({
      id: 'c1',
      contract_number: 'CTR-20260810-001',
      client_name: 'Cliente',
      status: 'assinado',
      locked: true,
      signed_at: '2026-08-01T10:00:00Z',
      total_value: 1000,
      template_version: 1,
      sections_snapshot: cloneDefaultSections(),
      details: completeDraft().details,
    }) as ContractRecord;

    const copy = buildDuplicate(original, 'CTR-20260810-002');
    expect(copy.status).toBe('rascunho');
    expect(copy.locked).toBe(false);
    expect(copy.signed_at).toBeNull();
    expect(copy.contract_number).toBe('CTR-20260810-002');
    expect(copy.template_version).toBe(CONTRACT_TEMPLATE_VERSION);
    expect(copy.sections_snapshot?.length).toBe(original.sections_snapshot?.length);
    // snapshot é cópia profunda: alterar a cópia não afeta o original
    (copy.details as any).items[0].name = 'Alterado';
    expect(original.details?.items[0].name).toBe('Refletor LED');
  });

  it('gera o próximo número sequencial da data sem colidir', () => {
    const date = new Date(2026, 7, 10);
    expect(nextContractNumber([], date)).toBe('CTR-20260810-001');
    expect(nextContractNumber(['CTR-20260810-001', 'CTR-20260810-004'], date)).toBe(
      'CTR-20260810-005',
    );
    expect(nextContractNumber(['CTR-20250101-009'], date)).toBe('CTR-20260810-001');
  });
});

describe('impressão e formatação', () => {
  it('monta documento A4 isolado com rodapé de identificação', () => {
    const html = buildContractPrintDocument('<section>Corpo</section>', 'Contrato CTR-1', 'CTR-1 — Cliente');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('print-color-adjust: exact');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('<section>Corpo</section>');
    expect(html).toContain('CTR-1 — Cliente');
    expect(html).toContain('doc-pagenum');
    // não carrega UI do app
    expect(html).not.toContain('DialogOverlay');
  });

  it('formata datas sem deslocamento de fuso e moeda em BRL', () => {
    expect(formatDateBR('2026-09-10')).toBe('10/09/2026');
    expect(formatDateBR('2026-09-10T23:00:00Z')).toBe('10/09/2026');
    expect(formatDateBR('')).toBe('Não informado');
    expect(formatCurrency(1234.5).replace(/\u00a0/g, ' ')).toBe('R$ 1.234,50');
    expect(formatCurrency(1000, false)).toBe('---');
  });

  it('monta link wa.me com DDI sem envio automático', () => {
    const link = buildWhatsAppLink('(62) 99999-9999', 'Olá');
    expect(link.startsWith('https://wa.me/5562999999999?text=')).toBe(true);
    expect(link).toContain('Ol%C3%A1');
  });
});
