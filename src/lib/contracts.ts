/**
 * Lógica pura do módulo de Contratos (LINE TAPE 2026).
 *
 * Aqui ficam tipos, modelo versionado padrão, validações, cálculos financeiros,
 * regras de status/imutabilidade e helpers de impressão. Nada neste arquivo
 * acessa rede, banco ou DOM global — para permitir testes unitários diretos.
 */

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type ContractStatus =
  | 'rascunho'
  | 'revisao'
  | 'enviado'
  | 'assinado'
  | 'cancelado';

/** Status legados ainda presentes em contratos antigos. */
export type LegacyContractStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface ContractSection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  order: number;
  /** Cláusulas essenciais não podem ser desativadas. */
  required?: boolean;
}

export interface ContractItem {
  id: string;
  /** ID estável do equipamento de origem, quando houver. */
  source_item_id?: string | null;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string | null;
}

export interface ContractInstallment {
  id: string;
  label: string;
  dueDate: string;
  amount: number;
}

export interface ContractWitness {
  name: string;
  document: string;
}

export interface ContractDetails {
  parties: {
    companyName: string;
    companyDocument: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyRepresentative: string;
    clientAddress: string;
    technicalResponsible: string;
  };
  event: {
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    setupDate: string;
    location: string;
    city: string;
  };
  items: ContractItem[];
  financials: {
    subtotal: number;
    discount: number;
    travel: number;
    lodging: number;
    taxes: number;
    downPayment: number;
    installments: ContractInstallment[];
  };
  witnesses: ContractWitness[];
  signature: {
    place: string;
    date: string;
    requireWitnesses: boolean;
  };
  notes: string;
}

export interface ContractRecord {
  id: string;
  contract_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_document: string | null;
  service_description: string;
  start_date: string;
  end_date: string;
  total_value: number;
  payment_terms: string | null;
  status: string;
  locked?: boolean | null;
  signed_at?: string | null;
  sent_at?: string | null;
  cancelled_at?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_version?: number | null;
  sections_snapshot?: ContractSection[] | null;
  details?: ContractDetails | null;
  client_id?: string | null;
  event_id?: string | null;
  quote_id?: string | null;
  source_quote_number?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContractHistoryEntry {
  id: string;
  contract_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor_name: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Modelo versionado padrão (v1)
 * ------------------------------------------------------------------ */

export const CONTRACT_TEMPLATE_NAME = 'Contrato de Locação e Serviços — LINE TAPE';
export const CONTRACT_TEMPLATE_VERSION = 1;

/**
 * Cláusulas padrão v1. O texto preserva o sentido das cláusulas já praticadas
 * pela empresa; a parametrização fica nos marcadores {{...}} substituídos na
 * geração. Não constitui aconselhamento jurídico.
 */
export const DEFAULT_CONTRACT_SECTIONS: ContractSection[] = [
  {
    id: 'objeto',
    title: 'Cláusula 1ª — Do Objeto',
    order: 1,
    enabled: true,
    required: true,
    content:
      'O presente contrato tem por objeto a prestação de serviços e/ou locação de equipamentos de iluminação, sonorização e estrutura pela CONTRATADA ao CONTRATANTE, conforme descrição do objeto e relação de equipamentos/serviços anexa a este instrumento.',
  },
  {
    id: 'evento',
    title: 'Cláusula 2ª — Do Evento, Prazos e Local',
    order: 2,
    enabled: true,
    required: true,
    content:
      'Os serviços serão executados no evento e local indicados neste contrato, observados a data de montagem, a data e os horários de realização e a data de desmontagem/devolução. Alterações de data, horário ou local dependem de concordância prévia e por escrito das partes e podem implicar revisão de valores.',
  },
  {
    id: 'equipamentos',
    title: 'Cláusula 3ª — Dos Equipamentos e Serviços',
    order: 3,
    enabled: true,
    required: true,
    content:
      'Os equipamentos e serviços contratados são os discriminados no anexo deste contrato, com respectivas quantidades e valores. Os equipamentos permanecem de propriedade da CONTRATADA, sendo cedidos ao CONTRATANTE em regime de locação pelo período contratado.',
  },
  {
    id: 'valores',
    title: 'Cláusula 4ª — Dos Valores e Forma de Pagamento',
    order: 4,
    enabled: true,
    required: true,
    content:
      'Pela execução do objeto, o CONTRATANTE pagará à CONTRATADA o valor total ajustado neste contrato, na forma e nos vencimentos aqui discriminados, incluindo sinal, parcelas e saldo, bem como eventuais valores de deslocamento, hospedagem e tributos, quando aplicáveis. O atraso no pagamento sujeita o CONTRATANTE aos encargos previstos nas condições gerais.',
  },
  {
    id: 'obrigacoes',
    title: 'Cláusula 5ª — Das Obrigações das Partes',
    order: 5,
    enabled: true,
    required: true,
    content:
      'A CONTRATADA obriga-se a fornecer os equipamentos e a equipe técnica em condições adequadas de uso e nos prazos ajustados. O CONTRATANTE obriga-se a garantir acesso ao local, energia elétrica adequada e estável, condições de segurança, autorizações e licenças necessárias ao evento, bem como espaço para montagem, guarda e desmontagem dos equipamentos.',
  },
  {
    id: 'cancelamento',
    title: 'Cláusula 6ª — Do Cancelamento e Remarcação',
    order: 6,
    enabled: true,
    required: true,
    content:
      'Em caso de cancelamento pelo CONTRATANTE, os valores já pagos a título de sinal destinam-se a cobrir custos de reserva e mobilização, na forma ajustada entre as partes. Pedidos de remarcação estão sujeitos à disponibilidade de agenda e de equipamentos. Casos fortuitos e de força maior serão tratados de comum acordo entre as partes.',
  },
  {
    id: 'danos',
    title: 'Cláusula 7ª — Danos e Responsabilidade',
    order: 7,
    enabled: true,
    required: true,
    content:
      'O CONTRATANTE responde por perdas, furtos e danos causados aos equipamentos enquanto estiverem sob sua guarda ou no local do evento, ressalvado o desgaste natural de uso e as falhas de responsabilidade da CONTRATADA. A CONTRATADA não responde por danos decorrentes de oscilação ou falta de energia, intempéries ou intervenções de terceiros não autorizados.',
  },
  {
    id: 'condicoes',
    title: 'Cláusula 8ª — Das Condições Gerais',
    order: 8,
    enabled: true,
    required: true,
    content:
      'Este contrato obriga as partes e seus sucessores. Alterações somente por aditivo escrito. A tolerância quanto a qualquer descumprimento não implica novação. As partes elegem o foro da comarca indicada na assinatura para dirimir eventuais controvérsias.',
  },
  {
    id: 'lgpd',
    title: 'Cláusula 9ª — Proteção de Dados (LGPD)',
    order: 9,
    enabled: false,
    content:
      'As partes tratarão os dados pessoais compartilhados exclusivamente para a execução deste contrato, observada a Lei nº 13.709/2018, adotando medidas de segurança compatíveis e não os utilizando para finalidades diversas sem autorização.',
  },
  {
    id: 'imagem',
    title: 'Cláusula 10ª — Uso de Imagem',
    order: 10,
    enabled: false,
    content:
      'O CONTRATANTE autoriza a CONTRATADA a registrar imagens da montagem e do evento para fins de portfólio e divulgação institucional, sem identificação de convidados, podendo tal autorização ser revogada por escrito.',
  },
];

/** Cópia profunda das cláusulas padrão (evita mutação acidental do modelo). */
export function cloneDefaultSections(): ContractSection[] {
  return DEFAULT_CONTRACT_SECTIONS.map((section) => ({ ...section }));
}

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

const LEGACY_STATUS_MAP: Record<string, ContractStatus> = {
  draft: 'rascunho',
  active: 'enviado',
  completed: 'assinado',
  cancelled: 'cancelado',
};

/** Converte status legados para o ciclo de vida atual, sem gravar no banco. */
export function normalizeStatus(status?: string | null): ContractStatus {
  if (!status) return 'rascunho';
  if (LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  const known: ContractStatus[] = ['rascunho', 'revisao', 'enviado', 'assinado', 'cancelado'];
  return known.includes(status as ContractStatus) ? (status as ContractStatus) : 'rascunho';
}

export const STATUS_LABELS: Record<ContractStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  enviado: 'Enviado',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
};

export const STATUS_COLORS: Record<ContractStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  revisao: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  enviado: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  assinado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  cancelado: 'bg-destructive/15 text-destructive',
};

const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  rascunho: ['revisao', 'enviado', 'cancelado'],
  revisao: ['rascunho', 'enviado', 'cancelado'],
  enviado: ['revisao', 'assinado', 'cancelado'],
  // Após assinado o conteúdo é imutável; só resta cancelar (mantendo a trava).
  assinado: ['cancelado'],
  cancelado: [],
};

export function allowedTransitions(status: string): ContractStatus[] {
  return TRANSITIONS[normalizeStatus(status)] ?? [];
}

export function canTransition(from: string, to: ContractStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/** Conteúdo só é editável enquanto o contrato não estiver travado/assinado. */
export function isContentLocked(contract: Pick<ContractRecord, 'status' | 'locked'>): boolean {
  return contract.locked === true || normalizeStatus(contract.status) === 'assinado';
}

/** Transições que exigem que não haja pendências de validação. */
export const STATUS_REQUIRING_COMPLETE: ContractStatus[] = ['enviado', 'assinado'];

/* ------------------------------------------------------------------ *
 * Financeiro
 * ------------------------------------------------------------------ */

export interface ContractFinancialSummary {
  itemsSubtotal: number;
  discount: number;
  travel: number;
  lodging: number;
  taxes: number;
  total: number;
  downPayment: number;
  installmentsTotal: number;
  scheduledTotal: number;
  balance: number;
  /** Divergência entre total do contrato e sinal + parcelas (alerta não bloqueante). */
  scheduleMismatch: number;
  hasScheduleMismatch: boolean;
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function computeItemsSubtotal(items: ContractItem[] = []): number {
  return roundMoney(
    items.reduce(
      (sum, item) => sum + (Number(item.subtotal) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
      0,
    ),
  );
}

export function computeFinancials(details?: Partial<ContractDetails> | null): ContractFinancialSummary {
  const financials = details?.financials;
  const itemsSubtotal = computeItemsSubtotal(details?.items || []);
  const discount = roundMoney(financials?.discount || 0);
  const travel = roundMoney(financials?.travel || 0);
  const lodging = roundMoney(financials?.lodging || 0);
  const taxes = roundMoney(financials?.taxes || 0);
  const total = roundMoney(itemsSubtotal - discount + travel + lodging + taxes);
  const downPayment = roundMoney(financials?.downPayment || 0);
  const installmentsTotal = roundMoney(
    (financials?.installments || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
  );
  const scheduledTotal = roundMoney(downPayment + installmentsTotal);
  const scheduleMismatch = roundMoney(total - scheduledTotal);

  return {
    itemsSubtotal,
    discount,
    travel,
    lodging,
    taxes,
    total,
    downPayment,
    installmentsTotal,
    scheduledTotal,
    balance: roundMoney(total - downPayment),
    scheduleMismatch,
    // Só alerta se houver algum agendamento informado.
    hasScheduleMismatch: scheduledTotal > 0 && Math.abs(scheduleMismatch) >= 0.01,
  };
}

/* ------------------------------------------------------------------ *
 * Validação
 * ------------------------------------------------------------------ */

export interface ContractIssue {
  section: string;
  field: string;
  message: string;
}

const DIGITS = (value: string) => (value || '').replace(/\D/g, '');

export function isValidDocument(value?: string | null): boolean {
  const digits = DIGITS(value || '');
  return digits.length === 11 || digits.length === 14;
}

export function isValidPhone(value?: string | null): boolean {
  const digits = DIGITS(value || '');
  return digits.length >= 10 && digits.length <= 13;
}

export interface ValidatableContract {
  contract_number?: string;
  client_name?: string;
  client_document?: string | null;
  client_phone?: string | null;
  service_description?: string;
  start_date?: string;
  end_date?: string;
  total_value?: number;
  details?: Partial<ContractDetails> | null;
  sections_snapshot?: ContractSection[] | null;
}

/**
 * Pendências que bloqueiam Finalizar/Enviar para assinatura.
 * Rascunho sempre pode ser salvo, mesmo com pendências.
 */
export function validateContract(contract: ValidatableContract): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const details = contract.details;
  const push = (section: string, field: string, message: string) =>
    issues.push({ section, field, message });

  // Partes
  if (!contract.client_name?.trim()) push('Partes', 'client_name', 'Informe a razão social / nome do contratante.');
  if (!isValidDocument(contract.client_document))
    push('Partes', 'client_document', 'CPF (11 dígitos) ou CNPJ (14 dígitos) do contratante é obrigatório.');
  if (!isValidPhone(contract.client_phone))
    push('Partes', 'client_phone', 'Telefone do contratante inválido ou não informado.');
  if (!details?.parties?.clientAddress?.trim())
    push('Partes', 'clientAddress', 'Endereço completo do contratante é obrigatório.');
  if (!details?.parties?.companyName?.trim())
    push('Partes', 'companyName', 'Informe a razão social da contratada.');
  if (!isValidDocument(details?.parties?.companyDocument))
    push('Partes', 'companyDocument', 'CNPJ da contratada é obrigatório.');
  if (!details?.parties?.companyRepresentative?.trim())
    push('Partes', 'companyRepresentative', 'Informe o responsável pela contratada.');

  // Objeto
  if (!contract.service_description?.trim())
    push('Objeto', 'service_description', 'Descreva o objeto do contrato.');

  // Evento / datas
  if (!contract.start_date) push('Evento', 'start_date', 'Data de início é obrigatória.');
  if (!contract.end_date) push('Evento', 'end_date', 'Data de término é obrigatória.');
  if (contract.start_date && contract.end_date && contract.end_date < contract.start_date)
    push('Evento', 'end_date', 'Data de término não pode ser anterior à data de início.');
  if (!details?.event?.date) push('Evento', 'eventDate', 'Data do evento é obrigatória.');
  if (!details?.event?.startTime) push('Evento', 'eventStartTime', 'Horário de início do evento é obrigatório.');
  if (!details?.event?.location?.trim()) push('Evento', 'eventLocation', 'Local do evento é obrigatório.');

  // Valores
  const financials = computeFinancials(details);
  if (!(Number(contract.total_value) > 0) && !(financials.total > 0))
    push('Valores', 'total_value', 'Valor total do contrato deve ser maior que zero.');
  if (!(financials.downPayment > 0) && (details?.financials?.installments || []).length === 0)
    push('Valores', 'payment', 'Informe a forma de pagamento: sinal e/ou parcelas com vencimento.');
  (details?.financials?.installments || []).forEach((installment, index) => {
    if (!installment.dueDate)
      push('Valores', `installment_${index}`, `Parcela ${index + 1}: informe o vencimento.`);
    if (!(Number(installment.amount) > 0))
      push('Valores', `installment_${index}`, `Parcela ${index + 1}: valor deve ser maior que zero.`);
  });

  // Cláusulas
  const enabled = (contract.sections_snapshot || []).filter((s) => s.enabled);
  if (enabled.length === 0) push('Cláusulas', 'sections', 'Selecione ao menos uma cláusula do modelo.');
  enabled
    .filter((s) => !s.content?.trim())
    .forEach((s) => push('Cláusulas', s.id, `Cláusula "${s.title}" está vazia.`));

  // Assinaturas
  if (!details?.signature?.place?.trim())
    push('Assinaturas', 'signaturePlace', 'Informe a cidade/foro de assinatura.');
  if (details?.signature?.requireWitnesses) {
    const witnesses = (details?.witnesses || []).filter((w) => w.name?.trim());
    if (witnesses.length < 2)
      push('Assinaturas', 'witnesses', 'Duas testemunhas são exigidas na configuração atual.');
    witnesses.forEach((w, index) => {
      if (!isValidDocument(w.document))
        push('Assinaturas', `witness_${index}`, `Testemunha ${index + 1}: CPF/CNPJ inválido.`);
    });
  }

  return issues;
}

export function groupIssuesBySection(issues: ContractIssue[]): Record<string, ContractIssue[]> {
  return issues.reduce<Record<string, ContractIssue[]>>((acc, issue) => {
    (acc[issue.section] ||= []).push(issue);
    return acc;
  }, {});
}

/* ------------------------------------------------------------------ *
 * Numeração e helpers
 * ------------------------------------------------------------------ */

export function generateContractNumber(date = new Date(), sequence?: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const suffix =
    sequence !== undefined
      ? String(sequence).padStart(3, '0')
      : String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `CTR-${year}${month}${day}-${suffix}`;
}

/** Próximo número livre a partir dos números já existentes na mesma data. */
export function nextContractNumber(existing: string[], date = new Date()): string {
  const base = generateContractNumber(date, 1).slice(0, -3);
  const used = existing
    .filter((n) => n?.startsWith(base))
    .map((n) => parseInt(n.slice(base.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${base}${String(next).padStart(3, '0')}`;
}

export function formatCurrency(value: number, canView = true): string {
  if (!canView) return '---';
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata YYYY-MM-DD sem conversão de fuso (evita exibir o dia anterior). */
export function formatDateBR(value?: string | null): string {
  const dateOnly = (value || '').split('T')[0];
  const [y, m, d] = dateOnly.split('-');
  return y && m && d ? `${d}/${m}/${y}` : 'Não informado';
}

/** Título de duplicata: novo rascunho a partir de um contrato existente. */
export function buildDuplicate(
  contract: ContractRecord,
  contractNumber: string,
): Partial<ContractRecord> {
  return {
    contract_number: contractNumber,
    client_name: contract.client_name,
    client_email: contract.client_email,
    client_phone: contract.client_phone,
    client_document: contract.client_document,
    service_description: contract.service_description,
    start_date: contract.start_date,
    end_date: contract.end_date,
    total_value: contract.total_value,
    payment_terms: contract.payment_terms,
    status: 'rascunho',
    locked: false,
    signed_at: null,
    sent_at: null,
    cancelled_at: null,
    template_id: contract.template_id ?? null,
    template_name: contract.template_name ?? CONTRACT_TEMPLATE_NAME,
    template_version: contract.template_version ?? CONTRACT_TEMPLATE_VERSION,
    sections_snapshot: (contract.sections_snapshot || cloneDefaultSections()).map((s) => ({ ...s })),
    details: contract.details ? JSON.parse(JSON.stringify(contract.details)) : null,
    client_id: contract.client_id ?? null,
    event_id: contract.event_id ?? null,
    quote_id: contract.quote_id ?? null,
  };
}

/** Link wa.me sem envio automático (abre a conversa com texto pronto). */
export function buildWhatsAppLink(phone?: string | null, message = ''): string {
  const digits = DIGITS(phone || '');
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/* ------------------------------------------------------------------ *
 * Impressão A4
 * ------------------------------------------------------------------ */

export const CONTRACT_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #ffffff; }
  body {
    font-family: Arial, Helvetica, sans-serif; color: #111111; margin: 0;
    font-size: 11.5px; line-height: 1.45;
  }
  h1 { font-size: 16px; margin: 0 0 4px; text-align: center; text-transform: uppercase; }
  h2 { font-size: 12.5px; margin: 0 0 4px; }
  h3 { font-size: 11.5px; margin: 0 0 3px; }
  p { margin: 0 0 4px; }
  .muted { color: #555555; }
  .doc-header {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    border-bottom: 1px solid #cccccc; padding-bottom: 8px; margin-bottom: 10px;
  }
  .doc-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
  .doc-meta { text-align: right; font-size: 10.5px; }
  section { margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
  section.doc-items, section.doc-clauses { break-inside: auto; page-break-inside: auto; }
  .doc-clause { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
  .doc-grid { display: flex; gap: 14px; }
  .doc-grid > div { flex: 1 1 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, img { break-inside: avoid; page-break-inside: avoid; }
  th, td {
    border: 1px solid #cccccc; padding: 5px; text-align: left; font-size: 10.5px;
    vertical-align: top; overflow-wrap: anywhere; word-break: break-word;
  }
  th { background: #f2f2f2; }
  col.c-photo { width: 74px; } col.c-item { width: auto; }
  col.c-qty { width: 42px; } col.c-unit { width: 90px; } col.c-total { width: 94px; }
  td img { width: 60px; height: 60px; object-fit: cover; border: 1px solid #dddddd; border-radius: 3px; }
  .doc-noimage {
    width: 60px; height: 60px; border: 1px solid #dddddd; border-radius: 3px; background: #f5f5f5;
    color: #777777; font-size: 8px; display: flex; align-items: center; justify-content: center; text-align: center;
  }
  .right { text-align: right; }
  .doc-totals { width: 64mm; margin-left: auto; break-inside: avoid; page-break-inside: avoid; }
  .doc-totals-row { display: flex; justify-content: space-between; padding: 1px 0; }
  .doc-total-final { border-top: 1px solid #111111; margin-top: 3px; padding-top: 3px; font-weight: bold; font-size: 13px; }
  .doc-signatures { break-inside: avoid; page-break-inside: avoid; margin-top: 18px; }
  .doc-sign-grid { display: flex; gap: 22px; margin-top: 22px; }
  .doc-sign-slot { flex: 1 1 0; text-align: center; }
  .doc-sign-line { border-top: 1px solid #111111; margin-bottom: 4px; height: 34px; }
  .doc-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    border-top: 1px solid #dddddd; padding-top: 3px; font-size: 9px; color: #666666;
    display: flex; justify-content: space-between;
  }
  .doc-root { padding-bottom: 14mm; }
  .doc-pagenum:after { content: counter(page); }
`;

/** Monta o documento isolado de impressão do contrato (sem UI do app). */
export function buildContractPrintDocument(
  bodyHtml: string,
  title: string,
  footerText = '',
): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${title}</title>
<style>${CONTRACT_PRINT_STYLES}</style>
</head><body><main class="doc-root">${bodyHtml}</main>
<div class="doc-footer"><span>${footerText}</span><span>Página <span class="doc-pagenum"></span></span></div>
</body></html>`;
}

/** Aguarda fontes e imagens do documento, com timeout de segurança. */
export async function waitForContractAssets(doc: Document, timeoutMs = 5000): Promise<void> {
  const guard = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  const fonts = (doc as any).fonts?.ready ? Promise.resolve((doc as any).fonts.ready) : Promise.resolve();
  const images = Promise.all(
    Array.from(doc.images || []).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
  await Promise.race([Promise.all([fonts, images]).then(() => undefined), guard]);
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export function emptyDetails(): ContractDetails {
  return {
    parties: {
      companyName: '',
      companyDocument: '',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyRepresentative: '',
      clientAddress: '',
      technicalResponsible: '',
    },
    event: { name: '', date: '', startTime: '', endTime: '', setupDate: '', location: '', city: '' },
    items: [],
    financials: { subtotal: 0, discount: 0, travel: 0, lodging: 0, taxes: 0, downPayment: 0, installments: [] },
    witnesses: [
      { name: '', document: '' },
      { name: '', document: '' },
    ],
    signature: { place: '', date: '', requireWitnesses: false },
    notes: '',
  };
}

/** Normaliza um registro vindo do banco (contratos legados incluídos). */
export function hydrateContract(row: any): ContractRecord {
  const base = emptyDetails();
  const details = (row?.details as Partial<ContractDetails> | null) || null;
  return {
    ...row,
    total_value: Number(row?.total_value) || 0,
    sections_snapshot:
      Array.isArray(row?.sections_snapshot) && row.sections_snapshot.length
        ? (row.sections_snapshot as ContractSection[])
        : cloneDefaultSections(),
    details: {
      ...base,
      ...details,
      parties: { ...base.parties, ...(details?.parties || {}) },
      event: { ...base.event, ...(details?.event || {}) },
      items: details?.items || [],
      financials: { ...base.financials, ...(details?.financials || {}) },
      witnesses: details?.witnesses?.length ? details.witnesses : base.witnesses,
      signature: { ...base.signature, ...(details?.signature || {}) },
      notes: details?.notes || '',
    },
  };
}
