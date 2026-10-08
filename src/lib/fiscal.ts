/**
 * Regras puras de Documentos Fiscais de transporte (NF-e 55, CT-e 57, MDF-e 58).
 *
 * IMPORTANTE:
 * - Nada aqui emite documento fiscal. Transmissão só ocorre na Edge Function
 *   `fiscal-document`, com certificado A1/provedor configurado por secrets.
 * - O sistema NUNCA assume CFOP/CST/CSOSN/NCM/ICMS: esses valores vêm de um
 *   perfil fiscal configurável e confirmado por contador/administrador.
 * - NFS-e municipal (serviço) é outro fluxo e não pode ser reutilizada aqui.
 */

export const FISCAL_BUCKET = 'fiscal-documents';

// ---------------------------------------------------------------------------
// Modelos e finalidades
// ---------------------------------------------------------------------------

export type FiscalModel = '55' | '57' | '58';

export const FISCAL_MODELS: FiscalModel[] = ['55', '57', '58'];

export const FISCAL_MODEL_LABELS: Record<FiscalModel, string> = {
  '55': 'NF-e 55 — Nota Fiscal eletrônica (remessa/retorno)',
  '57': 'CT-e 57 — Conhecimento de Transporte (prestação de serviço)',
  '58': 'MDF-e 58 — Manifesto Eletrônico de Documentos Fiscais',
};

export type FiscalPurpose = 'remessa' | 'retorno' | 'prestacao_servico' | 'manifesto' | 'outro';

export const FISCAL_PURPOSE_LABELS: Record<FiscalPurpose, string> = {
  remessa: 'Remessa (equipamento próprio/locado)',
  retorno: 'Retorno de remessa',
  prestacao_servico: 'Prestação de serviço de transporte',
  manifesto: 'Manifesto da viagem',
  outro: 'Outro',
};

/**
 * Modelo recomendado para transporte de equipamentos próprios/locados.
 * CT-e (57) é reservado à efetiva prestação de serviço de transporte a terceiros
 * e nunca é o padrão.
 */
export function recommendedModel(input: {
  isCarrierService: boolean;
  isReturn?: boolean;
}): FiscalModel {
  return input.isCarrierService ? '57' : '55';
}

/** MDF-e é aplicável quando há carga em veículo próprio cruzando UFs. */
export function requiresMdfe(input: {
  originState?: string | null;
  destinationState?: string | null;
  ownVehicle: boolean;
  hasFiscalDocuments: boolean;
}): boolean {
  const uf1 = (input.originState ?? '').toUpperCase();
  const uf2 = (input.destinationState ?? '').toUpperCase();
  if (!uf1 || !uf2) return false;
  return input.ownVehicle && input.hasFiscalDocuments && uf1 !== uf2;
}

// ---------------------------------------------------------------------------
// Situações e transições
// ---------------------------------------------------------------------------

export type FiscalStatus =
  | 'rascunho'
  | 'validado'
  | 'aguardando_assinatura'
  | 'enviado'
  | 'autorizado'
  | 'rejeitado'
  | 'cancelado'
  | 'encerrado';

export const FISCAL_STATUSES: FiscalStatus[] = [
  'rascunho',
  'validado',
  'aguardando_assinatura',
  'enviado',
  'autorizado',
  'rejeitado',
  'cancelado',
  'encerrado',
];

export const FISCAL_STATUS_LABELS: Record<FiscalStatus, string> = {
  rascunho: 'Rascunho',
  validado: 'Validado',
  aguardando_assinatura: 'Aguardando assinatura',
  enviado: 'Enviado',
  autorizado: 'Autorizado',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
  encerrado: 'Encerrado',
};

export function fiscalStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'autorizado':
    case 'encerrado':
      return 'default';
    case 'rejeitado':
    case 'cancelado':
      return 'destructive';
    case 'enviado':
    case 'aguardando_assinatura':
      return 'secondary';
    default:
      return 'outline';
  }
}

/** Espelha exatamente o trigger `fiscal_document_guard` no banco. */
const TRANSITIONS: Record<FiscalStatus, FiscalStatus[]> = {
  rascunho: ['validado', 'cancelado'],
  validado: ['rascunho', 'aguardando_assinatura', 'enviado', 'cancelado'],
  aguardando_assinatura: ['validado', 'enviado', 'rejeitado', 'cancelado'],
  enviado: ['autorizado', 'rejeitado', 'cancelado'],
  rejeitado: ['rascunho', 'validado', 'enviado', 'cancelado'],
  autorizado: ['cancelado', 'encerrado'],
  cancelado: [],
  encerrado: [],
};

export function nextFiscalStatuses(status: string): FiscalStatus[] {
  return TRANSITIONS[status as FiscalStatus] ?? [];
}

export function canTransitionFiscalStatus(from: string, to: string): boolean {
  return nextFiscalStatuses(from).includes(to as FiscalStatus);
}

export interface AuthorizationEvidence {
  access_key?: string | null;
  protocol_number?: string | null;
  authorized_at?: string | null;
  xml_path?: string | null;
  xml_sha256?: string | null;
  authorization_source?: string | null;
}

/**
 * Só é permitido rotular como autorizado com protocolo REAL da SEFAZ.
 * Espelha as exigências do trigger no banco.
 */
export function validateAuthorizationEvidence(evidence: AuthorizationEvidence): string[] {
  const errors: string[] = [];
  if (!isValidAccessKey(evidence.access_key ?? '')) {
    errors.push('Chave de acesso com 44 dígitos é obrigatória para autorização.');
  }
  if (!(evidence.protocol_number ?? '').trim()) {
    errors.push('Número de protocolo da SEFAZ é obrigatório.');
  }
  if (!(evidence.authorized_at ?? '').trim()) {
    errors.push('Data/hora de autorização é obrigatória.');
  }
  if (!(evidence.xml_path ?? '').trim()) {
    errors.push('XML autorizado precisa estar armazenado no bucket privado.');
  }
  if (!/^[0-9a-f]{64}$/.test(evidence.xml_sha256 ?? '')) {
    errors.push('Hash SHA-256 do XML autorizado é obrigatório.');
  }
  if (!['sefaz_provider', 'external_import'].includes(evidence.authorization_source ?? '')) {
    errors.push('Origem da autorização inválida.');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Validações de documentos e endereços
// ---------------------------------------------------------------------------

export const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '');

export function isValidCNPJ(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(c[i]) * pos;
      pos -= 1;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function isValidCPF(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCpfCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length === 11) return isValidCPF(c);
  if (c.length === 14) return isValidCNPJ(c);
  return false;
}

export function isValidCEP(value: string): boolean {
  return /^[0-9]{8}$/.test(onlyDigits(value));
}

export function isValidUF(value: string): boolean {
  return (BR_STATES as readonly string[]).includes((value ?? '').toUpperCase());
}

/** Inscrição Estadual: 2 a 14 dígitos, ou literal ISENTO. */
export function isValidIE(value: string): boolean {
  const raw = (value ?? '').trim().toUpperCase();
  if (raw === 'ISENTO' || raw === 'ISENTA') return true;
  const digits = onlyDigits(raw);
  return digits.length >= 2 && digits.length <= 14;
}

export function isValidAccessKey(value: string): boolean {
  return /^[0-9]{44}$/.test(onlyDigits(value));
}

/** Dígito verificador (módulo 11) da chave de 44 dígitos. */
export function accessKeyCheckDigitValid(value: string): boolean {
  const k = onlyDigits(value);
  if (k.length !== 44) return false;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = 42, w = 0; i >= 0; i -= 1, w += 1) {
    sum += Number(k[i]) * weights[w % weights.length];
  }
  const rest = sum % 11;
  const dv = rest === 0 || rest === 1 ? 0 : 11 - rest;
  return dv === Number(k[43]);
}

/** Modelo (posições 21-22) extraído da chave de acesso. */
export function modelFromAccessKey(value: string): string | null {
  const k = onlyDigits(value);
  return k.length === 44 ? k.slice(20, 22) : null;
}

export function isValidPlate(value: string): boolean {
  const p = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}[0-9]{4}$/.test(p) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p);
}

// ---------------------------------------------------------------------------
// Itens e totais (sempre em centavos)
// ---------------------------------------------------------------------------

export interface FiscalItemInput {
  description: string;
  ncm?: string | null;
  cfop?: string | null;
  unit?: string | null;
  quantity: number;
  unit_value_cents: number;
  cst?: string | null;
  csosn?: string | null;
  icms_rate?: number | null;
  ipi_rate?: number | null;
}

export const itemTotalCents = (item: Pick<FiscalItemInput, 'quantity' | 'unit_value_cents'>): number =>
  Math.round((Number(item.quantity) || 0) * (Number(item.unit_value_cents) || 0));

export interface FiscalTotals {
  productsCents: number;
  icmsCents: number;
  ipiCents: number;
  documentCents: number;
}

export function calculateFiscalTotals(
  items: FiscalItemInput[],
  extra: { freightCents?: number; insuranceCents?: number; discountCents?: number } = {}
): FiscalTotals {
  let productsCents = 0;
  let icmsCents = 0;
  let ipiCents = 0;

  for (const item of items) {
    const total = itemTotalCents(item);
    productsCents += total;
    icmsCents += Math.round((total * (Number(item.icms_rate) || 0)) / 100);
    ipiCents += Math.round((total * (Number(item.ipi_rate) || 0)) / 100);
  }

  const freight = Math.max(0, Math.round(extra.freightCents ?? 0));
  const insurance = Math.max(0, Math.round(extra.insuranceCents ?? 0));
  const discount = Math.max(0, Math.round(extra.discountCents ?? 0));

  const documentCents = Math.max(0, productsCents + freight + insurance + ipiCents - discount);

  return { productsCents, icmsCents, ipiCents, documentCents };
}

export const formatCentsBRL = (cents: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (Number(cents) || 0) / 100
  );

// ---------------------------------------------------------------------------
// Perfil fiscal (nada é assumido pelo sistema)
// ---------------------------------------------------------------------------

export interface FiscalProfileLike {
  id?: string;
  name?: string | null;
  model?: string | null;
  environment?: string | null;
  operation_nature?: string | null;
  default_cfop?: string | null;
  default_cst?: string | null;
  default_csosn?: string | null;
  default_ncm?: string | null;
  default_unit?: string | null;
  icms_rate?: number | null;
  tax_regime?: string | null;
  emitter?: Record<string, unknown> | null;
  accountant_confirmed?: boolean | null;
  is_active?: boolean | null;
}

export function validateFiscalProfile(profile: FiscalProfileLike): string[] {
  const errors: string[] = [];
  if (!(profile.name ?? '').trim()) errors.push('Informe o nome do perfil fiscal.');
  if (!FISCAL_MODELS.includes((profile.model ?? '') as FiscalModel)) {
    errors.push('Modelo inválido (use 55, 57 ou 58).');
  }
  if (!['homologacao', 'producao'].includes(profile.environment ?? '')) {
    errors.push('Ambiente inválido (homologação ou produção).');
  }
  if (!(profile.operation_nature ?? '').trim()) {
    errors.push('Informe a natureza da operação (nenhum valor é presumido pelo sistema).');
  }
  if (profile.model === '55') {
    if (!/^[0-9]{4}$/.test(profile.default_cfop ?? '')) errors.push('CFOP padrão deve ter 4 dígitos.');
    if (!(profile.default_cst ?? '').trim() && !(profile.default_csosn ?? '').trim()) {
      errors.push('Informe CST ou CSOSN conforme o regime tributário.');
    }
    if ((profile.default_cst ?? '').trim() && (profile.default_csosn ?? '').trim()) {
      errors.push('Use CST ou CSOSN, nunca ambos.');
    }
  }
  if ((profile.default_ncm ?? '').trim() && !/^[0-9]{8}$/.test(profile.default_ncm ?? '')) {
    errors.push('NCM padrão deve ter 8 dígitos.');
  }
  const emitter = (profile.emitter ?? {}) as Record<string, string>;
  if (!isValidCNPJ(emitter.cnpj ?? '')) errors.push('CNPJ do emitente inválido.');
  if (!isValidUF(emitter.state ?? '')) errors.push('UF do emitente inválida.');
  if (!isValidIE(emitter.ie ?? '')) errors.push('Inscrição Estadual do emitente inválida.');
  return errors;
}

// ---------------------------------------------------------------------------
// Documento: formulário do assistente
// ---------------------------------------------------------------------------

export interface PartyForm {
  name: string;
  document: string;
  ie: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export const emptyParty = (): PartyForm => ({
  name: '',
  document: '',
  ie: '',
  address: '',
  city: '',
  state: '',
  zip: '',
});

export interface FiscalDocumentForm {
  profile_id: string;
  transport_id: string;
  model: FiscalModel;
  purpose: FiscalPurpose;
  operation_nature: string;
  environment: 'homologacao' | 'producao';
  series: string;
  issue_date: string;
  emitter: PartyForm;
  recipient: PartyForm;
  delivery: PartyForm;
  same_delivery: boolean;
  vehicle: { plate: string; model: string; state: string };
  driver: { name: string; document: string; phone: string };
  route_states: string[];
  referenced_keys: string[];
  return_of_document_id: string;
  items: FiscalItemInput[];
  freight_cents: number;
  insurance_cents: number;
  discount_cents: number;
  notes: string;
}

export const emptyFiscalDocumentForm = (): FiscalDocumentForm => ({
  profile_id: '',
  transport_id: '',
  model: '55',
  purpose: 'remessa',
  operation_nature: '',
  environment: 'homologacao',
  series: '1',
  issue_date: new Date().toISOString().slice(0, 10),
  emitter: emptyParty(),
  recipient: emptyParty(),
  delivery: emptyParty(),
  same_delivery: true,
  vehicle: { plate: '', model: '', state: '' },
  driver: { name: '', document: '', phone: '' },
  route_states: [],
  referenced_keys: [],
  return_of_document_id: '',
  items: [],
  freight_cents: 0,
  insurance_cents: 0,
  discount_cents: 0,
  notes: '',
});

function validateParty(party: PartyForm, label: string, requireIE: boolean): string[] {
  const errors: string[] = [];
  if (!party.name.trim()) errors.push(`${label}: informe o nome/razão social.`);
  if (!isValidCpfCnpj(party.document)) errors.push(`${label}: CNPJ/CPF inválido.`);
  if (!party.address.trim()) errors.push(`${label}: informe o endereço.`);
  if (!party.city.trim()) errors.push(`${label}: informe o município.`);
  if (!isValidUF(party.state)) errors.push(`${label}: UF inválida.`);
  if (!isValidCEP(party.zip)) errors.push(`${label}: CEP inválido (8 dígitos).`);
  if (requireIE && party.ie.trim() && !isValidIE(party.ie)) {
    errors.push(`${label}: Inscrição Estadual inválida.`);
  }
  return errors;
}

/** Validação completa exigida para sair de "rascunho" e ir para "validado". */
export function validateFiscalDocumentForm(form: FiscalDocumentForm): string[] {
  const errors: string[] = [];

  if (!form.profile_id) errors.push('Selecione o perfil fiscal (CFOP/CST/NCM/impostos).');
  if (!FISCAL_MODELS.includes(form.model)) errors.push('Modelo inválido.');
  if (!form.operation_nature.trim()) errors.push('Informe a natureza da operação.');
  if (!/^[0-9]{1,3}$/.test(form.series)) errors.push('Série inválida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.issue_date)) errors.push('Data de emissão inválida.');

  errors.push(...validateParty(form.emitter, 'Emitente', true));

  if (form.model !== '58') {
    errors.push(...validateParty(form.recipient, 'Destinatário', true));
    if (!form.same_delivery) {
      errors.push(...validateParty(form.delivery, 'Local de entrega', false));
    }
  }

  if (form.model === '58' || form.model === '57') {
    if (!isValidPlate(form.vehicle.plate)) errors.push('Placa do veículo inválida.');
    if (!isValidUF(form.vehicle.state)) errors.push('UF de licenciamento do veículo inválida.');
    if (!form.driver.name.trim()) errors.push('Informe o condutor.');
    if (!isValidCPF(form.driver.document)) errors.push('CPF do condutor inválido.');
    if (form.route_states.length < 2) errors.push('Informe ao menos UF de início e fim do percurso.');
  }

  for (const uf of form.route_states) {
    if (!isValidUF(uf)) errors.push(`UF de percurso inválida: ${uf}.`);
  }

  for (const key of form.referenced_keys) {
    if (!isValidAccessKey(key)) errors.push(`Chave referenciada inválida: ${key}.`);
  }

  if (form.purpose === 'retorno' && !form.return_of_document_id && form.referenced_keys.length === 0) {
    errors.push('Retorno exige o documento de remessa original ou sua chave de acesso.');
  }

  if (form.model !== '58') {
    if (form.items.length === 0) errors.push('Inclua ao menos um item.');
    form.items.forEach((item, index) => {
      const n = index + 1;
      if (!item.description.trim()) errors.push(`Item ${n}: informe a descrição.`);
      if (!(Number(item.quantity) > 0)) errors.push(`Item ${n}: quantidade deve ser maior que zero.`);
      if (Number(item.unit_value_cents) < 0) errors.push(`Item ${n}: valor não pode ser negativo.`);
      if (!/^[0-9]{4}$/.test(item.cfop ?? '')) errors.push(`Item ${n}: CFOP deve ter 4 dígitos.`);
      if (!/^[0-9]{8}$/.test(item.ncm ?? '')) errors.push(`Item ${n}: NCM deve ter 8 dígitos.`);
      if (!(item.unit ?? '').trim()) errors.push(`Item ${n}: informe a unidade.`);
      if (!(item.cst ?? '').trim() && !(item.csosn ?? '').trim()) {
        errors.push(`Item ${n}: informe CST ou CSOSN.`);
      }
    });

    const totals = calculateFiscalTotals(form.items, {
      freightCents: form.freight_cents,
      insuranceCents: form.insurance_cents,
      discountCents: form.discount_cents,
    });
    if (totals.documentCents <= 0) errors.push('O total do documento deve ser maior que zero.');
    if (form.discount_cents > totals.productsCents) {
      errors.push('Desconto maior que o total dos produtos.');
    }
  }

  return errors;
}

/** Converte o formulário no registro persistido (sem status/chave/protocolo). */
export function fiscalFormToRecord(form: FiscalDocumentForm) {
  const totals = calculateFiscalTotals(form.items, {
    freightCents: form.freight_cents,
    insuranceCents: form.insurance_cents,
    discountCents: form.discount_cents,
  });

  return {
    profile_id: form.profile_id || null,
    transport_id: form.transport_id || null,
    model: form.model,
    series: form.series,
    purpose: form.purpose,
    operation_nature: form.operation_nature.trim(),
    environment: form.environment,
    issue_date: form.issue_date,
    emitter: { ...form.emitter, document: onlyDigits(form.emitter.document), zip: onlyDigits(form.emitter.zip) },
    recipient: {
      ...form.recipient,
      document: onlyDigits(form.recipient.document),
      zip: onlyDigits(form.recipient.zip),
    },
    delivery: form.same_delivery
      ? {}
      : { ...form.delivery, document: onlyDigits(form.delivery.document), zip: onlyDigits(form.delivery.zip) },
    vehicle: { ...form.vehicle, plate: form.vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') },
    driver: { ...form.driver, document: onlyDigits(form.driver.document) },
    route_states: form.route_states.map((uf) => uf.toUpperCase()),
    referenced_keys: form.referenced_keys.map(onlyDigits),
    return_of_document_id: form.return_of_document_id || null,
    totals: {
      products_cents: totals.productsCents,
      icms_cents: totals.icmsCents,
      ipi_cents: totals.ipiCents,
      freight_cents: form.freight_cents,
      insurance_cents: form.insurance_cents,
      discount_cents: form.discount_cents,
    },
    total_products_cents: totals.productsCents,
    total_document_cents: totals.documentCents,
    notes: form.notes || null,
  } as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Prontidão para transmitir (modo seguro de preparação)
// ---------------------------------------------------------------------------

export interface FiscalReadinessInput {
  providerConfigured: boolean;
  certificateConfigured: boolean;
  profile: FiscalProfileLike | null;
  environment: string;
}

export interface FiscalReadiness {
  canTransmit: boolean;
  blockers: string[];
  isHomologation: boolean;
}

export function evaluateFiscalReadiness(input: FiscalReadinessInput): FiscalReadiness {
  const blockers: string[] = [];
  if (!input.providerConfigured) {
    blockers.push('Provedor/API de emissão (NF-e/MDF-e) não configurado nos secrets.');
  }
  if (!input.certificateConfigured) {
    blockers.push('Certificado digital A1 e senha não configurados nos secrets.');
  }
  if (!input.profile) {
    blockers.push('Nenhum perfil fiscal selecionado.');
  } else {
    if (!input.profile.accountant_confirmed) {
      blockers.push('Perfil fiscal ainda não confirmado pelo contador/administrador.');
    }
    if (!input.profile.is_active) blockers.push('Perfil fiscal inativo.');
    if (input.profile.environment && input.profile.environment !== input.environment) {
      blockers.push('Ambiente do documento difere do ambiente do perfil fiscal.');
    }
  }
  return {
    canTransmit: blockers.length === 0,
    blockers,
    isHomologation: input.environment !== 'producao',
  };
}

export const HOMOLOGATION_WATERMARK = 'SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO';

/** DANFE/DAMDFE só pode ser gerado a partir de XML autorizado. */
export function canGeneratePrint(doc: {
  status?: string | null;
  xml_path?: string | null;
  access_key?: string | null;
  protocol_number?: string | null;
}): boolean {
  return (
    doc.status === 'autorizado' &&
    !!doc.xml_path &&
    !!(doc.protocol_number ?? '').trim() &&
    isValidAccessKey(doc.access_key ?? '')
  );
}

// ---------------------------------------------------------------------------
// Caminhos de armazenamento
// ---------------------------------------------------------------------------

export function buildFiscalStoragePath(
  documentId: string,
  kind: 'xml' | 'pdf',
  suffix = 'documento'
): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'documento';
  return `fiscal-documents/${documentId}/${safeSuffix}-${Date.now()}.${kind}`;
}

// ---------------------------------------------------------------------------
// Checklist pré-viagem
// ---------------------------------------------------------------------------

export interface TripChecklistInput {
  hasAuthorizedNfe: boolean;
  needsMdfe: boolean;
  hasAuthorizedMdfe: boolean;
  hasDriver: boolean;
  hasPlate: boolean;
  isHomologation: boolean;
}

export interface ChecklistItem {
  label: string;
  ok: boolean;
  blocking: boolean;
}

export function buildTripChecklist(input: TripChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { label: 'NF-e de remessa autorizada', ok: input.hasAuthorizedNfe, blocking: true },
    { label: 'Condutor informado', ok: input.hasDriver, blocking: true },
    { label: 'Placa do veículo informada', ok: input.hasPlate, blocking: true },
  ];
  if (input.needsMdfe) {
    items.push({ label: 'MDF-e autorizado para a viagem', ok: input.hasAuthorizedMdfe, blocking: true });
  }
  if (input.isHomologation) {
    items.push({
      label: 'Ambiente de homologação — documentos SEM VALOR FISCAL',
      ok: false,
      blocking: false,
    });
  }
  return items;
}

export const checklistReady = (items: ChecklistItem[]): boolean =>
  items.filter((i) => i.blocking).every((i) => i.ok);

// ---------------------------------------------------------------------------
// Importação de XML autorizado de emissor externo
// ---------------------------------------------------------------------------

export interface ParsedAuthorizedXml {
  ok: boolean;
  error?: string;
  access_key?: string;
  protocol_number?: string;
  authorized_at?: string;
  model?: string;
  environment?: 'homologacao' | 'producao';
  total_document_cents?: number;
}

const pick = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
};

/**
 * Analisa um XML de NF-e/MDF-e/CT-e **autorizado** (com protNFe/protMDFe/protCTe).
 * Sem protocolo real, a importação é recusada — nunca simula autorização.
 */
export function parseAuthorizedXml(xml: string): ParsedAuthorizedXml {
  if (!xml || !xml.includes('<')) return { ok: false, error: 'Arquivo XML inválido.' };

  const hasProt = /<prot(NFe|MDFe|CTe)\b/i.test(xml) || /<infProt\b/i.test(xml);
  if (!hasProt) {
    return { ok: false, error: 'XML sem protocolo de autorização da SEFAZ (protNFe/protMDFe/protCTe).' };
  }

  const cStat = pick(xml, 'cStat');
  if (cStat && !['100', '150', '132'].includes(cStat)) {
    return { ok: false, error: `XML não autorizado pela SEFAZ (cStat ${cStat}).` };
  }

  const rawKey = pick(xml, 'chNFe') ?? pick(xml, 'chMDFe') ?? pick(xml, 'chCTe');
  const key = onlyDigits(rawKey ?? '');
  if (!isValidAccessKey(key)) return { ok: false, error: 'Chave de acesso ausente ou inválida no XML.' };
  if (!accessKeyCheckDigitValid(key)) {
    return { ok: false, error: 'Dígito verificador da chave de acesso inválido.' };
  }

  const protocol = pick(xml, 'nProt');
  if (!protocol) return { ok: false, error: 'Número de protocolo ausente no XML.' };

  const authorizedAt = pick(xml, 'dhRecbto');
  if (!authorizedAt) return { ok: false, error: 'Data/hora de autorização ausente no XML.' };

  const tpAmb = pick(xml, 'tpAmb');
  const environment: 'homologacao' | 'producao' = tpAmb === '1' ? 'producao' : 'homologacao';

  const vNF = pick(xml, 'vNF') ?? pick(xml, 'vTPrest');
  const totalCents = vNF ? Math.round(Number(vNF) * 100) : undefined;

  return {
    ok: true,
    access_key: key,
    protocol_number: protocol,
    authorized_at: authorizedAt,
    model: modelFromAccessKey(key) ?? undefined,
    environment,
    total_document_cents: Number.isFinite(totalCents) ? totalCents : undefined,
  };
}

/** SHA-256 hex do conteúdo do XML (para integridade/auditoria). */
export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
