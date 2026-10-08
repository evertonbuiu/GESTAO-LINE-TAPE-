// Utilidades comuns do Worker (respostas, erros no formato do PostgREST, CORS).

export class ApiError extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
  toJSON() {
    return { code: this.code, details: this.details, hint: this.hint, message: this.message };
  }
}

export function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '*';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, content-profile, range, range-unit, x-upsert, cache-control, x-supabase-api-version',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Location, Range-Unit, Preference-Applied, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(data, status = 200, headers = {}) {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorResponse(err) {
  if (err instanceof ApiError) return json(err.toJSON(), err.status);
  console.error('Erro interno', err && (err.stack || err));
  return json({ code: 'XX000', message: String((err && err.message) || err), details: null, hint: null }, 500);
}

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString().replace('Z', '+00:00');
}

export async function readJson(request) {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'PGRST102', 'Empty or invalid json');
  }
}

const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', typeof text === 'string' ? enc.encode(text) : text));
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export { enc };
