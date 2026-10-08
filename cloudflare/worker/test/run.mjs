import fs from 'node:fs';
// Testes locais do Worker: banco D1 simulado com o SQLite do Node.
// Rodar com:  node --no-warnings cloudflare/worker/test/run.mjs
import { D1Shim } from './d1shim.mjs';
import worker from '../src/index.js';
import { Db } from '../src/db.js';
import { adminCreateUser } from '../src/auth.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = path.join(here, '..', 'migrations');

class R2Mock {
  constructor() {
    this.m = new Map();
  }
  async head(k) {
    return this.m.has(k) ? {} : null;
  }
  async put(k, body, opts = {}) {
    const buf = body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer();
    this.m.set(k, { buf, meta: opts.httpMetadata || {} });
  }
  async get(k) {
    const o = this.m.get(k);
    if (!o) return null;
    return {
      body: o.buf,
      httpEtag: '"x"',
      httpMetadata: o.meta,
      writeHttpMetadata(h) {
        if (o.meta.contentType) h.set('Content-Type', o.meta.contentType);
      },
    };
  }
  async delete(k) {
    this.m.delete(k);
  }
}

export async function setup() {
  const d1 = new D1Shim();
  for (const f of fs.readdirSync(migrations).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort()) {
    d1.applyFile(path.join(migrations, f));
  }
  const env = { DB: d1, JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres', FILES: new R2Mock(), ALLOWED_ORIGINS: '*' };
  const db = new Db(d1);
  async function mkUser(username, role, password = 'senha123') {
    const u = await adminCreateUser(db, { email: `${username}@linetape.local`, password, user_metadata: { username, name: username } });
    await d1.prepare("INSERT INTO user_credentials (id, username, password_hash, name, is_active) VALUES (?, ?, 'managed-by-auth', ?, 1)").bind(u.id, username, username).run();
    await d1.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').bind(u.id, role).run();
    return u;
  }
  return { d1, env, db, mkUser };
}

export function client(env) {
  let token = null;
  async function call(method, p, { body, headers = {}, raw = false } = {}) {
    const h = { 'Content-Type': 'application/json', ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await worker.fetch(
      new Request('http://w' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }),
      env,
      { waitUntil() {} },
    );
    if (raw) return res;
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    call,
    async login(username, password = 'senha123') {
      const r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: `${username}@linetape.local`, password } });
      if (r.status !== 200) throw new Error('login falhou: ' + JSON.stringify(r.data));
      token = r.data.access_token;
      return r.data;
    },
    logout() {
      token = null;
    },
  };
}

let failures = 0;
let passes = 0;
export function ok(cond, msg, extra) {
  if (cond) {
    passes++;
  } else {
    failures++;
    console.log('  FALHOU:', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : '');
  }
}
export function summary() {
  console.log(`\n${passes} verificações ok, ${failures} falhas`);
  if (failures) process.exitCode = 1;
}

const suites = process.argv.slice(2).length ? process.argv.slice(2) : ['core', 'rules', 'policies'];
for (const s of suites) {
  console.log(`== ${s}`);
  const mod = await import(`./suite-${s}.mjs`);
  await mod.default({ setup, client, ok });
}
summary();
