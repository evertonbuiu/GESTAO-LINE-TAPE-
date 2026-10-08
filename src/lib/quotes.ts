// Lógica pura da aba Orçamentos — testável e sem dependências de UI/rede.

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type TaxOption = 'sem_nota' | 'isento' | 'com_nota';

export interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  image_url?: string;
}

export interface QuoteTotalsInput {
  items: Array<{ quantity: number; unit_price: number }>;
  discount_percentage: number;
  travel_expense: number;
  accommodation_expense: number;
  tax_option: TaxOption;
  tax_percentage: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

export interface StoredQuoteTaxInput {
  subtotal: number;
  discount_amount?: number | null;
  travel_expense?: number | null;
  accommodation_expense?: number | null;
  total_amount: number;
  tax_amount?: number | null;
  tax_percentage?: number | null;
}

/** Resolve o imposto exibido em documentos, inclusive para orçamentos antigos. */
export function resolveStoredQuoteTax(input: StoredQuoteTaxInput) {
  const base = roundMoney((Number(input.subtotal) || 0) - (Number(input.discount_amount) || 0));
  const extras = roundMoney(
    (Number(input.travel_expense) || 0) + (Number(input.accommodation_expense) || 0),
  );
  const inferredAmount = roundMoney(Math.max(0, (Number(input.total_amount) || 0) - base - extras));
  const tax_amount = input.tax_amount == null ? inferredAmount : roundMoney(Number(input.tax_amount) || 0);
  const inferredPercentage = base + tax_amount > 0 ? roundMoney((tax_amount / (base + tax_amount)) * 100) : 0;
  const tax_percentage = input.tax_percentage == null
    ? inferredPercentage
    : roundMoney(Number(input.tax_percentage) || 0);

  return { tax_amount, tax_percentage };
}

/** Arredondamento monetário consistente em centavos. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Regra fiscal preservada: imposto "por dentro" quando a opção é "com_nota".
 * imposto = (subtotal - desconto) * aliquota / (1 - aliquota)
 */
export function calculateQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotal = roundMoney(
    (input.items || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0,
    ),
  );

  const discountPct = Math.min(Math.max(Number(input.discount_percentage) || 0, 0), 100);
  const discount_amount = roundMoney(subtotal * (discountPct / 100));

  const taxDecimal = (Number(input.tax_percentage) || 0) / 100;
  const base = subtotal - discount_amount;
  const applyTax = input.tax_option === 'com_nota' && taxDecimal > 0 && taxDecimal < 1;
  const tax_amount = applyTax ? roundMoney((base * taxDecimal) / (1 - taxDecimal)) : 0;

  const total_amount = roundMoney(
    base +
      (Number(input.travel_expense) || 0) +
      (Number(input.accommodation_expense) || 0) +
      tax_amount,
  );

  return { subtotal, discount_amount, tax_amount, total_amount };
}

/** ID estável para itens do orçamento (nunca use o nome como identidade). */
export function makeItemId(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function onlyDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export interface QuoteListRecord {
  quote_number?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_document?: string;
  event_name?: string;
  event_location?: string;
  event_date?: string;
  total_amount?: number;
  status?: QuoteStatus | string;
  created_at?: string;
}

export interface QuoteFilters {
  search?: string;
  status?: string; // 'all' | QuoteStatus
  month?: string; // 'all' | '01'..'12'
  year?: number | null;
}

export type QuoteSort = 'event_date_asc' | 'event_date_desc' | 'created_desc' | 'total_desc' | 'client_asc';

export function matchesQuoteSearch(quote: QuoteListRecord, rawSearch: string): boolean {
  const search = (rawSearch || '').trim();
  if (!search) return true;

  const digits = onlyDigits(search);
  if (digits.length >= 3 && onlyDigits(quote.client_phone).includes(digits)) return true;
  if (digits.length >= 3 && onlyDigits(quote.client_document).includes(digits)) return true;

  const needle = normalizeText(search);
  const haystack = [
    quote.quote_number,
    quote.client_name,
    quote.client_email,
    quote.event_name,
    quote.event_location,
  ]
    .map(normalizeText)
    .join(' | ');

  return haystack.includes(needle);
}

export function filterQuotes<T extends QuoteListRecord>(quotes: T[], filters: QuoteFilters): T[] {
  const { search = '', status = 'all', month = 'all', year = null } = filters || {};

  return (quotes || []).filter((quote) => {
    if (!matchesQuoteSearch(quote, search)) return false;
    if (status !== 'all' && (quote.status || 'draft') !== status) return false;

    if (month === 'all' && !year) return true;

    const dateOnly = (quote.event_date || '').split('T')[0];
    const [y, m] = dateOnly.split('-');
    if (!y || !m) return month === 'all' && !year;

    if (month !== 'all' && m !== month) return false;
    if (year && parseInt(y, 10) !== year) return false;
    return true;
  });
}

export function sortQuotes<T extends QuoteListRecord>(quotes: T[], sort: QuoteSort): T[] {
  const list = [...(quotes || [])];
  const dateValue = (value?: string) => {
    const dateOnly = (value || '').split('T')[0];
    const time = Date.parse(dateOnly);
    return Number.isNaN(time) ? null : time;
  };

  switch (sort) {
    case 'event_date_desc':
    case 'event_date_asc': {
      const direction = sort === 'event_date_asc' ? 1 : -1;
      return list.sort((a, b) => {
        const da = dateValue(a.event_date);
        const db = dateValue(b.event_date);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return (da - db) * direction;
      });
    }
    case 'total_desc':
      return list.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    case 'client_asc':
      return list.sort((a, b) => normalizeText(a.client_name).localeCompare(normalizeText(b.client_name)));
    case 'created_desc':
    default:
      return list.sort((a, b) => (dateValue(b.created_at) || 0) - (dateValue(a.created_at) || 0));
  }
}

// ---------------------------------------------------------------------------
// Validação por etapa do assistente
// ---------------------------------------------------------------------------

export interface QuoteStepData {
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  event_date?: string;
  discount_percentage?: number;
  travel_expense?: number;
  accommodation_expense?: number;
  tax_option?: TaxOption;
  tax_percentage?: number;
}

export interface StepValidation {
  valid: boolean;
  errors: string[];
}

export function validateQuoteStep(
  step: 1 | 2 | 3,
  data: QuoteStepData,
  items: Array<{ quantity: number; unit_price: number }>,
): StepValidation {
  const errors: string[] = [];

  if (step === 1) {
    if (!data.client_name || !data.client_name.trim()) errors.push('Informe o nome do cliente.');
    if (!data.event_date) errors.push('Informe a data do evento.');
    if (data.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client_email)) {
      errors.push('E-mail do cliente inválido.');
    }
  }

  if (step === 2) {
    if (!items || items.length === 0) errors.push('Adicione pelo menos um item ao orçamento.');
    if ((items || []).some((item) => (Number(item.quantity) || 0) <= 0)) {
      errors.push('A quantidade dos itens deve ser maior que zero.');
    }
    if ((items || []).some((item) => (Number(item.unit_price) || 0) < 0)) {
      errors.push('O preço unitário não pode ser negativo.');
    }
  }

  if (step === 3) {
    const discount = Number(data.discount_percentage) || 0;
    if (discount < 0 || discount > 100) errors.push('O desconto deve estar entre 0% e 100%.');
    if ((Number(data.travel_expense) || 0) < 0) errors.push('A despesa de viagem não pode ser negativa.');
    if ((Number(data.accommodation_expense) || 0) < 0) errors.push('A hospedagem não pode ser negativa.');
    if (data.tax_option === 'com_nota') {
      const tax = Number(data.tax_percentage) || 0;
      if (tax <= 0 || tax >= 100) errors.push('A porcentagem da nota deve estar entre 0% e 100%.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Dados mínimos para liberar as abas de Contrato e Recibo. */
export function hasMinimumForDocuments(
  data: QuoteStepData,
  items: Array<{ quantity: number; unit_price: number }>,
): boolean {
  return Boolean(data.client_name && data.client_name.trim()) && (items || []).length > 0;
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = onlyDigits(phone);
  const withCountry = digits.length > 0 && !digits.startsWith('55') ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppMessage(quote: {
  quote_number?: string;
  client_name?: string;
  event_name?: string;
  event_date?: string;
  total_amount?: number;
  showValues?: boolean;
}): string {
  const dateOnly = (quote.event_date || '').split('T')[0];
  const [y, m, d] = dateOnly.split('-');
  const formattedDate = y && m && d ? `${d}/${m}/${y}` : '';

  const lines = [
    `Olá${quote.client_name ? `, ${quote.client_name}` : ''}! Aqui é da LINE TAPE Iluminação.`,
    `Segue o orçamento ${quote.quote_number || ''}${quote.event_name ? ` para ${quote.event_name}` : ''}.`,
    formattedDate ? `Data do evento: ${formattedDate}.` : '',
    quote.showValues && typeof quote.total_amount === 'number'
      ? `Valor total: ${quote.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      : '',
    'Qualquer dúvida, estamos à disposição.',
  ].filter(Boolean);

  return lines.join('\n');
}

/** Cria uma cópia do orçamento pronta para virar um novo registro. */
export function buildDuplicatePayload<T extends Record<string, unknown>>(
  quote: T,
  newQuoteNumber: string,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...quote };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.event_id;
  copy.quote_number = newQuoteNumber;
  copy.status = 'draft';

  const products = Array.isArray(quote.products) ? (quote.products as QuoteItem[]) : [];
  copy.products = products.map((product) => ({ ...product, id: makeItemId() }));

  return copy;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export function getQuoteStatusLabel(status: string | undefined): string {
  return QUOTE_STATUS_LABELS[(status || 'draft') as QuoteStatus] || 'Rascunho';
}

export function getQuoteStatusClasses(status: string | undefined): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'sent':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'rejected':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
