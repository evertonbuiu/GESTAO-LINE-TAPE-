// CORS seguro e explícito para a função emit-nfse.
// Nunca reflete origens arbitrárias: apenas produção, previews oficiais do
// projeto no domínio Lovable e localhost (somente em desenvolvimento).

export const ALLOWED_ORIGINS = [
  'https://linetape-iluminacao.lovable.app',
  'https://preview--linetape-iluminacao.lovable.app',
  'https://id-preview--b20ed6db-6569-4397-bdc1-d90583ef9a95.lovable.app',
];

// Previews gerados dinamicamente pelo Lovable para ESTE projeto.
const LOVABLE_PREVIEW_PATTERNS: RegExp[] = [
  /^https:\/\/(id-)?preview--linetape-iluminacao\.lovable\.app$/,
  /^https:\/\/(id-)?preview--b20ed6db-6569-4397-bdc1-d90583ef9a95\.lovable\.app$/,
  /^https:\/\/b20ed6db-6569-4397-bdc1-d90583ef9a95\.lovableproject\.com$/,
  /^https:\/\/b20ed6db-6569-4397-bdc1-d90583ef9a95\.sandbox\.lovable\.dev$/,
];

const LOCALHOST_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const ALLOWED_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'x-client-info',
  'x-supabase-api-version',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
  'x-region',
  'accept-profile',
  'content-profile',
].join(', ');

export function isDevEnvironment(env: string | undefined | null): boolean {
  const value = (env ?? '').toLowerCase();
  return value === 'development' || value === 'dev' || value === 'local';
}

export function isOriginAllowed(origin: string | null, isDev = false): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (LOVABLE_PREVIEW_PATTERNS.some((re) => re.test(origin))) return true;
  if (isDev && LOCALHOST_PATTERN.test(origin)) return true;
  return false;
}

/** Cabeçalhos CORS. Sem Access-Control-Allow-Origin quando a origem não é permitida. */
export function buildCorsHeaders(origin: string | null, isDev = false): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (isOriginAllowed(origin, isDev)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
  }
  return headers;
}
