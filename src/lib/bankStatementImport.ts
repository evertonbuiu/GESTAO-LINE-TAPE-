/**
 * Importação de extrato bancário — parsing OFX, normalização e idempotência.
 *
 * Regras:
 * - Nunca há dados simulados: tudo vem do arquivo enviado pelo usuário.
 * - Datas sempre em horário local, no formato YYYY-MM-DD (sem deslocamento de fuso).
 * - Valores tratados em centavos para evitar erro de ponto flutuante.
 * - Fingerprint determinístico garante idempotência forte na gravação.
 */

export const MAX_STATEMENT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SUPPORTED_STATEMENT_EXTENSIONS = ['.ofx', '.csv', '.xlsx', '.xls'] as const;

export type StatementExtension = (typeof SUPPORTED_STATEMENT_EXTENSIONS)[number];

export interface ParsedStatementTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  type: 'income' | 'expense';
  fitId?: string | null;
  memo?: string | null;
}

export interface OfxParseResult {
  transactions: ParsedStatementTransaction[];
  discarded: number;
  errors: string[];
}

/** Extensão em minúsculas, aceitando nomes em qualquer caixa. */
export const getFileExtension = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  return idx < 0 ? '' : fileName.slice(idx).toLowerCase();
};

export const isSupportedStatementFile = (fileName: string): boolean =>
  (SUPPORTED_STATEMENT_EXTENSIONS as readonly string[]).includes(getFileExtension(fileName));

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export const validateStatementFile = (
  file: { name: string; size: number } | null | undefined,
): FileValidationResult => {
  if (!file) return { ok: false, error: 'Selecione um arquivo de extrato.' };
  if (!isSupportedStatementFile(file.name)) {
    return { ok: false, error: 'Formato inválido. Use OFX, CSV, XLSX ou XLS.' };
  }
  if (file.size <= 0) return { ok: false, error: 'Arquivo vazio.' };
  if (file.size > MAX_STATEMENT_FILE_BYTES) {
    return { ok: false, error: 'Arquivo maior que 10 MB.' };
  }
  return { ok: true };
};

/** Converte DTPOSTED (YYYYMMDD[HHMMSS][.xxx][TZ]) em data local YYYY-MM-DD. */
export const parseOfxDate = (raw: string): string | null => {
  const cleaned = (raw ?? '').trim();
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (year < 1900 || year > 2999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // valida dia real do mês (ex.: 31/02 é inválido)
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${y}-${m}-${d}`;
};

/** TRNAMT aceita "-1234.56" e "-1.234,56". */
export const parseOfxAmount = (raw: string): number | null => {
  let text = (raw ?? '').trim();
  if (!text) return null;
  const negative = text.startsWith('-');
  text = text.replace(/[^0-9.,]/g, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : Math.abs(value);
};

const tagValue = (block: string, tag: string): string => {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : '';
};

/** Descrição normalizada: sem acentos, maiúsculas, espaços colapsados. */
export const normalizeDescription = (value: string): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

export const toCents = (amount: number): number => Math.round(Math.abs(amount) * 100);

/** Parser real de OFX (SGML ou XML), lendo apenas blocos STMTTRN. */
export const parseOfx = (content: string): OfxParseResult => {
  const errors: string[] = [];
  const text = content ?? '';
  if (!/<STMTTRN>/i.test(text)) {
    return { transactions: [], discarded: 0, errors: ['Arquivo OFX sem transações (STMTTRN).'] };
  }

  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: ParsedStatementTransaction[] = [];
  let discarded = 0;

  blocks.forEach((block, index) => {
    const date = parseOfxDate(tagValue(block, 'DTPOSTED'));
    const amount = parseOfxAmount(tagValue(block, 'TRNAMT'));
    const name = tagValue(block, 'NAME');
    const memo = tagValue(block, 'MEMO');
    const fitId = tagValue(block, 'FITID');
    const trnType = tagValue(block, 'TRNTYPE').toUpperCase();

    if (!date) {
      discarded += 1;
      errors.push(`Transação ${index + 1}: data inválida.`);
      return;
    }
    if (amount === null || amount === 0) {
      discarded += 1;
      errors.push(`Transação ${index + 1}: valor inválido ou zerado.`);
      return;
    }

    const description = (name || memo || trnType || 'Lançamento').trim();

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      fitId: fitId || null,
      memo: memo || null,
    });
  });

  return { transactions, discarded, errors };
};

/** Hash FNV-1a 64 bits (determinístico, síncrono) em hexadecimal. */
const fnv1a64 = (input: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
};

export interface FingerprintInput {
  accountId: string;
  fitId?: string | null;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
}

/**
 * Fingerprint determinístico: conta + FITID (quando existir) + data + tipo +
 * valor em centavos + descrição normalizada.
 */
export const buildImportFingerprint = (input: FingerprintInput): string => {
  const canonical = [
    input.accountId.trim().toLowerCase(),
    (input.fitId ?? '').trim().toUpperCase(),
    input.date.slice(0, 10),
    input.type,
    String(toCents(input.amount)),
    normalizeDescription(input.description),
  ].join('|');
  return `v1:${fnv1a64(canonical)}`;
};

export interface DedupeResult<T> {
  toInsert: T[];
  duplicates: number;
}

/** Remove duplicados internos do arquivo e os já existentes no banco. */
export const dedupeByFingerprint = <T extends { fingerprint: string }>(
  rows: T[],
  existing: Set<string>,
): DedupeResult<T> => {
  const seen = new Set<string>();
  const toInsert: T[] = [];
  let duplicates = 0;
  rows.forEach((row) => {
    if (existing.has(row.fingerprint) || seen.has(row.fingerprint)) {
      duplicates += 1;
      return;
    }
    seen.add(row.fingerprint);
    toInsert.push(row);
  });
  return { toInsert, duplicates };
};

export const summarizeImport = (imported: number, duplicates: number): string => {
  if (imported === 0 && duplicates > 0) return 'Extrato já sincronizado';
  if (duplicates === 0) return `${imported} movimentação(ões) importada(s)`;
  return `${imported} importada(s) · ${duplicates} duplicada(s) ignorada(s)`;
};
