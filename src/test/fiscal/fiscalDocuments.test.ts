import { describe, expect, it } from 'vitest';
import {
  accessKeyCheckDigitValid,
  buildFiscalStoragePath,
  buildTripChecklist,
  calculateFiscalTotals,
  canGeneratePrint,
  canTransitionFiscalStatus,
  checklistReady,
  emptyFiscalDocumentForm,
  emptyParty,
  evaluateFiscalReadiness,
  fiscalFormToRecord,
  isValidAccessKey,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  isValidIE,
  isValidPlate,
  isValidUF,
  nextFiscalStatuses,
  parseAuthorizedXml,
  recommendedModel,
  requiresMdfe,
  validateAuthorizationEvidence,
  validateFiscalDocumentForm,
  validateFiscalProfile,
  type FiscalDocumentForm,
  type FiscalProfileLike,
} from '@/lib/fiscal';

const validKey = (() => {
  // Constrói uma chave válida de 44 dígitos com DV correto (modelo 55).
  const base = '52' + '2401' + '12345678000195' + '55' + '001' + '000000123' + '1' + '12345678';
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = base.length - 1, w = 0; i >= 0; i -= 1, w += 1) {
    sum += Number(base[i]) * weights[w % weights.length];
  }
  const rest = sum % 11;
  const dv = rest === 0 || rest === 1 ? 0 : 11 - rest;
  return `${base}${dv}`;
})();

const filledParty = () => ({
  ...emptyParty(),
  name: 'Letra 3D line tape ILUMINACAO LTDA',
  document: '12.345.678/0001-95',
  ie: '1234567890',
  address: 'Rua Um, 100',
  city: 'Goiânia',
  state: 'GO',
  zip: '74000000',
});

const validForm = (): FiscalDocumentForm => ({
  ...emptyFiscalDocumentForm(),
  profile_id: 'profile-1',
  operation_nature: 'Remessa para locação',
  emitter: filledParty(),
  recipient: { ...filledParty(), name: 'Cliente SP', city: 'São Paulo', state: 'SP', zip: '01000000' },
  items: [
    { description: 'Refletor LED', ncm: '94054090', cfop: '6908', unit: 'UN', quantity: 2, unit_value_cents: 50000, cst: '000', icms_rate: 0 },
  ],
});

describe('validações de documentos e partes', () => {
  it('valida CNPJ, CPF, CEP, UF, IE e placa', () => {
    expect(isValidCNPJ('12.345.678/0001-95')).toBe(true);
    expect(isValidCNPJ('12.345.678/0001-00')).toBe(false);
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCEP('74000-000')).toBe(true);
    expect(isValidCEP('740')).toBe(false);
    expect(isValidUF('GO')).toBe(true);
    expect(isValidUF('XX')).toBe(false);
    expect(isValidIE('ISENTO')).toBe(true);
    expect(isValidIE('1')).toBe(false);
    expect(isValidPlate('ABC1D23')).toBe(true);
    expect(isValidPlate('AB1234')).toBe(false);
  });

  it('valida chave de acesso de 44 dígitos com dígito verificador', () => {
    expect(isValidAccessKey(validKey)).toBe(true);
    expect(accessKeyCheckDigitValid(validKey)).toBe(true);
    expect(isValidAccessKey('123')).toBe(false);
    const broken = `${validKey.slice(0, 43)}${(Number(validKey[43]) + 1) % 10}`;
    expect(accessKeyCheckDigitValid(broken)).toBe(false);
  });

  it('rejeita formulário incompleto e aceita formulário completo', () => {
    expect(validateFiscalDocumentForm(emptyFiscalDocumentForm()).length).toBeGreaterThan(0);
    expect(validateFiscalDocumentForm(validForm())).toEqual([]);
  });

  it('rejeita chave referenciada inválida', () => {
    const form = { ...validForm(), referenced_keys: ['123'] };
    expect(validateFiscalDocumentForm(form).some((e) => e.toLowerCase().includes('chave'))).toBe(true);
  });
});

describe('cálculos em centavos', () => {
  it('soma produtos, frete, seguro e desconto sem perda de centavos', () => {
    const totals = calculateFiscalTotals(
      [
        { description: 'A', quantity: 3, unit_value_cents: 3333, icms_rate: 18 },
        { description: 'B', quantity: 1, unit_value_cents: 1, icms_rate: 0 },
      ],
      { freightCents: 1000, insuranceCents: 500, discountCents: 200 }
    );
    expect(totals.productsCents).toBe(10000);
    expect(totals.icmsCents).toBe(1800);
    expect(totals.documentCents).toBe(10000 + 1000 + 500 - 200);
    expect(Number.isInteger(totals.documentCents)).toBe(true);
  });

  it('converte o formulário em registro com totais em centavos', () => {
    const record = fiscalFormToRecord(validForm());
    expect(record.total_products_cents).toBe(100000);
    expect(record.total_document_cents).toBe(100000);
    expect(record.status).toBeUndefined();
  });
});

describe('modelo aplicável', () => {
  it('usa NF-e 55 por padrão e CT-e apenas em prestação de serviço', () => {
    expect(recommendedModel({ isCarrierService: false })).toBe('55');
    expect(recommendedModel({ isCarrierService: true })).toBe('57');
  });

  it('exige MDF-e apenas em operação interestadual com documentos', () => {
    expect(requiresMdfe({ originState: 'GO', destinationState: 'SP', ownVehicle: true, hasFiscalDocuments: true })).toBe(true);
    expect(requiresMdfe({ originState: 'GO', destinationState: 'GO', ownVehicle: true, hasFiscalDocuments: true })).toBe(false);
    expect(requiresMdfe({ originState: 'GO', destinationState: 'SP', ownVehicle: true, hasFiscalDocuments: false })).toBe(false);
  });
});

describe('máquina de estados', () => {
  it('permite apenas transições seguras', () => {
    expect(canTransitionFiscalStatus('rascunho', 'validado')).toBe(true);
    expect(canTransitionFiscalStatus('rascunho', 'autorizado')).toBe(false);
    expect(canTransitionFiscalStatus('autorizado', 'rascunho')).toBe(false);
    expect(canTransitionFiscalStatus('autorizado', 'cancelado')).toBe(true);
    expect(nextFiscalStatuses('cancelado')).toEqual([]);
  });

  it('é idempotente para o mesmo estado', () => {
    expect(canTransitionFiscalStatus('enviado', 'enviado')).toBe(false);
  });

  it('só aceita autorização com chave, protocolo e data reais', () => {
    expect(
      validateAuthorizationEvidence({
        access_key: validKey,
        protocol_number: '1234',
        authorized_at: '2026-01-01T10:00:00-03:00',
        xml_path: 'fiscal-documents/doc-1/autorizado.xml',
        xml_sha256: 'a'.repeat(64),
        authorization_source: 'external_import',
      })
    ).toEqual([]);
    expect(validateAuthorizationEvidence({ access_key: '', protocol_number: '', authorized_at: '' }).length).toBe(6);
  });
});

describe('prontidão e bloqueio de transmissão', () => {
  const profile: FiscalProfileLike = {
    id: 'p1',
    name: 'Perfil GO',
    model: '55',
    environment: 'homologacao',
    accountant_confirmed: false,
    is_active: true,
    default_cfop: '6908',
    default_ncm: '94054090',
  };

  it('bloqueia sem provedor, sem certificado e sem confirmação do contador', () => {
    const result = evaluateFiscalReadiness({
      providerConfigured: false,
      certificateConfigured: false,
      profile,
      environment: 'producao',
    });
    expect(result.canTransmit).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it('libera somente com tudo configurado e contador confirmado', () => {
    const result = evaluateFiscalReadiness({
      providerConfigured: true,
      certificateConfigured: true,
      profile: { ...profile, accountant_confirmed: true, environment: 'producao' },
      environment: 'producao',
    });
    expect(result.canTransmit).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('exige perfil fiscal completo', () => {
    expect(validateFiscalProfile({ ...profile, default_cfop: '' }).length).toBeGreaterThan(0);
  });
});

describe('importação de XML autorizado', () => {
  const xml = `<nfeProc><NFe><infNFe><total><ICMSTot><vNF>1000.00</vNF></ICMSTot></total></infNFe></NFe>
    <protNFe><infProt><tpAmb>2</tpAmb><chNFe>${validKey}</chNFe><nProt>352400000000001</nProt>
    <dhRecbto>2026-01-15T10:00:00-03:00</dhRecbto><cStat>100</cStat></infProt></protNFe></nfeProc>`;

  it('extrai chave, protocolo, ambiente e total', () => {
    const parsed = parseAuthorizedXml(xml);
    expect(parsed.ok).toBe(true);
    expect(parsed.access_key).toBe(validKey);
    expect(parsed.protocol_number).toBe('352400000000001');
    expect(parsed.environment).toBe('homologacao');
    expect(parsed.total_document_cents).toBe(100000);
  });

  it('recusa XML sem protocolo', () => {
    expect(parseAuthorizedXml('<NFe><infNFe></infNFe></NFe>').ok).toBe(false);
  });

  it('recusa XML rejeitado pela SEFAZ', () => {
    const rejected = xml.replace('<cStat>100</cStat>', '<cStat>539</cStat>');
    const parsed = parseAuthorizedXml(rejected);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/não autorizado/i);
  });

  it('recusa arquivo que não é XML', () => {
    expect(parseAuthorizedXml('texto qualquer').ok).toBe(false);
  });
});

describe('impressão e armazenamento', () => {
  it('gera DANFE apenas de documento autorizado com XML', () => {
    expect(canGeneratePrint({ status: 'autorizado', access_key: validKey, protocol_number: '1', xml_path: 'a.xml' })).toBe(true);
    expect(canGeneratePrint({ status: 'rascunho', access_key: validKey, protocol_number: '1', xml_path: 'a.xml' })).toBe(false);
    expect(canGeneratePrint({ status: 'autorizado', access_key: null, protocol_number: '1', xml_path: 'a.xml' })).toBe(false);
  });

  it('monta caminho seguro no bucket privado', () => {
    const path = buildFiscalStoragePath('doc-1', 'xml', validKey);
    expect(path.startsWith('fiscal-documents/doc-1/')).toBe(true);
    expect(path).not.toMatch(/\.\./);
  });
});

describe('checklist pré-viagem', () => {
  it('aponta pendências bloqueantes e libera quando tudo está pronto', () => {
    const pending = buildTripChecklist({
      hasAuthorizedNfe: false,
      needsMdfe: true,
      hasAuthorizedMdfe: false,
      hasDriver: false,
      hasPlate: false,
      isHomologation: true,
    });
    expect(checklistReady(pending)).toBe(false);

    const ready = buildTripChecklist({
      hasAuthorizedNfe: true,
      needsMdfe: true,
      hasAuthorizedMdfe: true,
      hasDriver: true,
      hasPlate: true,
      isHomologation: false,
    });
    expect(checklistReady(ready)).toBe(true);
  });
});
