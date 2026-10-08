import { supabase } from '@/integrations/supabase/client';

export const RECEIPT_BUCKET = 'worker-receipts';
export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const LEGACY_QUOTE_IMAGE_BUCKET = 'quote-product-images';
export const EQUIPMENT_IMAGE_BUCKET = 'equipment-images';
/** Comprovantes financeiros (adiantamentos/notinhas) — bucket privado. */
export const FINANCE_RECEIPT_BUCKET = 'receipts';
/** Comprovantes de despesas fixas — bucket privado. */
export const EXPENSE_RECEIPT_BUCKET = 'expense-receipts';

/** Buckets privados de comprovantes: sempre exibidos por URL assinada. */
export const PRIVATE_RECEIPT_BUCKETS = [
  RECEIPT_BUCKET,
  FINANCE_RECEIPT_BUCKET,
  EXPENSE_RECEIPT_BUCKET,
] as const;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const RECEIPT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const;

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const RECEIPT_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf'] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

export interface UploadValidation {
  ok: boolean;
  error?: string;
}

/** Extensão em minúsculas, sem ponto. */
export const fileExtension = (name: string): string => {
  const clean = name.split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  return idx === -1 ? '' : clean.slice(idx + 1).toLowerCase();
};

/** Caminho sem traversal, sem barra inicial/dupla, tamanho e extensão válidos. */
export const isSafeStoragePath = (path: string, allowedExts: readonly string[]): boolean => {
  if (!path) return false;
  if (path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('//')) return false;
  if (path.includes('\\')) return false;
  if (path.length > 300) return false;
  return allowedExts.includes(fileExtension(path));
};

/** Valida MIME e tamanho antes de enviar. */
export const validateUpload = (
  file: { name: string; type: string; size: number },
  opts: { allowedMime: readonly string[]; allowedExts: readonly string[]; maxBytes: number }
): UploadValidation => {
  if (!opts.allowedMime.includes(file.type)) {
    return { ok: false, error: `Tipo de arquivo não permitido (${file.type || 'desconhecido'}).` };
  }
  if (!opts.allowedExts.includes(fileExtension(file.name))) {
    return { ok: false, error: 'Extensão de arquivo não permitida.' };
  }
  if (file.size <= 0) return { ok: false, error: 'Arquivo vazio.' };
  if (file.size > opts.maxBytes) {
    return { ok: false, error: `Arquivo maior que ${Math.round(opts.maxBytes / (1024 * 1024))} MB.` };
  }
  return { ok: true };
};

export const validateReceiptUpload = (file: { name: string; type: string; size: number }) =>
  validateUpload(file, {
    allowedMime: RECEIPT_MIME_TYPES,
    allowedExts: RECEIPT_EXTENSIONS,
    maxBytes: MAX_RECEIPT_BYTES,
  });

export const validateProductImageUpload = (file: { name: string; type: string; size: number }) =>
  validateUpload(file, {
    allowedMime: IMAGE_MIME_TYPES,
    allowedExts: IMAGE_EXTENSIONS,
    maxBytes: MAX_IMAGE_BYTES,
  });

/**
 * Normaliza imagens de itens importados/antigos para uma URL exibível.
 * Alguns registros guardam apenas o caminho do objeto, enquanto versões
 * anteriores usaram o bucket quote-product-images.
 */
export const resolveProductImageDisplayUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  if (/^(data:|blob:)/i.test(clean)) return clean;
  if (/^https:\/\//i.test(clean)) return clean;
  if (/^http:\/\//i.test(clean)) return clean.replace(/^http:\/\//i, 'https://');

  const withoutLeadingSlash = clean.replace(/^\/+/, '');
  const legacyPrefix = `${LEGACY_QUOTE_IMAGE_BUCKET}/`;
  const currentPrefix = `${PRODUCT_IMAGE_BUCKET}/`;
  const equipmentPrefix = `${EQUIPMENT_IMAGE_BUCKET}/`;
  const bucket = withoutLeadingSlash.startsWith(legacyPrefix)
    ? LEGACY_QUOTE_IMAGE_BUCKET
    : withoutLeadingSlash.startsWith(equipmentPrefix)
      ? EQUIPMENT_IMAGE_BUCKET
    : PRODUCT_IMAGE_BUCKET;
  const path = withoutLeadingSlash
    .replace(new RegExp(`^${legacyPrefix}`), '')
    .replace(new RegExp(`^${currentPrefix}`), '')
    .replace(new RegExp(`^${equipmentPrefix}`), '');

  if (!path) return undefined;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

/** Caminho seguro e isolado por usuário para comprovantes. */
export const buildReceiptPath = (userId: string, originalName: string, now = Date.now()): string =>
  `receipts/${userId}-${now}.${fileExtension(originalName) || 'bin'}`;

/**
 * Converte uma URL pública legada (ou caminho já limpo) no caminho do objeto
 * dentro do bucket. Retorna null quando não pertence ao bucket informado.
 */
export const extractStoragePath = (urlOrPath: string, bucket: string): string | null => {
  if (!urlOrPath) return null;
  const value = urlOrPath.trim();
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/${bucket}/`,
    `/${bucket}/`,
  ];
  for (const marker of markers) {
    const idx = value.indexOf(marker);
    if (idx !== -1) {
      const path = value.slice(idx + marker.length).split('?')[0];
      return path ? decodeURIComponent(path) : null;
    }
  }
  if (/^https?:\/\//i.test(value)) return null;
  return value.replace(/^\/+/, '') || null;
};

/**
 * URL assinada temporária (1h) para um objeto de bucket privado.
 * Aceita caminho ou URL pública legada. Retorna null se não for possível assinar.
 */
export const getSignedStorageUrl = async (
  urlOrPath: string | null | undefined,
  bucket: string = RECEIPT_BUCKET,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> => {
  if (!urlOrPath) return null;
  const path = extractStoragePath(urlOrPath, bucket);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar URL assinada:', error);
    return null;
  }
  return data.signedUrl;
};

/** Atalho para comprovantes de colaboradores/diaristas. */
export const getSignedReceiptUrl = (urlOrPath: string | null | undefined) =>
  getSignedStorageUrl(urlOrPath, RECEIPT_BUCKET);

/**
 * Descobre a qual bucket privado de comprovantes o valor pertence.
 * Aceita URL pública/assinada legada ou caminho puro.
 */
export const detectReceiptBucket = (
  urlOrPath: string,
  fallback: string = RECEIPT_BUCKET
): string | null => {
  for (const bucket of PRIVATE_RECEIPT_BUCKETS) {
    if (urlOrPath.includes(`/${bucket}/`)) return bucket;
  }
  if (/^https?:\/\//i.test(urlOrPath)) return null; // URL externa/bucket público legado
  if (urlOrPath.startsWith('expense-advance-receipts/')) return FINANCE_RECEIPT_BUCKET;
  return fallback;
};

/**
 * Resolve a URL de exibição de um comprovante:
 * assina (1h) quando o objeto está em bucket privado de comprovantes,
 * caso contrário devolve a URL original (buckets públicos legados).
 */
export const resolveReceiptDisplayUrl = async (
  urlOrPath: string | null | undefined,
  fallbackBucket: string = RECEIPT_BUCKET
): Promise<string | null> => {
  if (!urlOrPath) return null;
  const bucket = detectReceiptBucket(urlOrPath, fallbackBucket);
  if (!bucket) return urlOrPath;
  return (await getSignedStorageUrl(urlOrPath, bucket)) ?? null;
};
