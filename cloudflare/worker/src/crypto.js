// JWT (HS256) e hash de senha (PBKDF2-SHA256) usando apenas WebCrypto,
// disponível nativamente no Cloudflare Workers.
import { ApiError, b64url, b64urlDecode, enc, hex, randomToken } from './util.js';

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signJwt(payload, secret) {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(s), enc.encode(`${h}.${p}`));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, 'PGRST303', 'JWT expired');
  }
  return payload;
}

// Workers limita PBKDF2 a 100.000 iterações.
const ITER = 100000;

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const bits = await derive(password, salt, ITER);
  return `pbkdf2$${ITER}$${b64url(salt)}$${b64url(bits)}`;
}

async function derive(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const bits = await derive(password, b64urlDecode(saltB64), Number(iterStr));
  const a = hex(bits);
  const b = hex(b64urlDecode(hashB64));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { randomToken };
