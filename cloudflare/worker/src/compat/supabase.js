// Substituto do supabase-js usado DENTRO das funções de servidor portadas.
//
// As funções originais (Deno) faziam createClient(SUPABASE_URL, chave) e
// conversavam com o Supabase pela rede. Aqui o "cliente" chama o próprio
// Worker diretamente (sem rede), com as mesmas regras:
//  - chave de serviço (SUPABASE_SERVICE_ROLE_KEY): ignora permissões por linha
//  - chave pública + Authorization do usuário: age como o usuário
import { handleRest } from '../rest.js';
import { handleStorage } from '../storage.js';
import { sessionFromRequest, adminCreateUser, adminDeleteUser, adminUpdateUser, userObject } from '../auth.js';
import { Db } from '../db.js';

let RUNTIME = null; // { env, db } da requisição atual

export function setRuntime(rt) {
  RUNTIME = rt;
}

function rt() {
  if (!RUNTIME) throw new Error('compat/supabase: runtime não configurado');
  return RUNTIME;
}

async function ctxFor(key, authHeader) {
  const { env, db } = rt();
  if (key && env.SERVICE_ROLE_KEY && key === env.SERVICE_ROLE_KEY && !authHeader) {
    return { uid: null, roles: new Set(), permissions: {}, service: true };
  }
  if (key === '__service__' && !authHeader) return { uid: null, roles: new Set(), permissions: {}, service: true };
  const req = new Request('http://local/', { headers: authHeader ? { Authorization: authHeader } : {} });
  const { buildContext } = await import('../index.js');
  return buildContext(req, env, db);
}

function errFrom(data, status) {
  if (data && typeof data === 'object') {
    return { message: data.message || data.msg || data.error || 'Erro', code: data.code ?? String(status), details: data.details ?? null, hint: data.hint ?? null };
  }
  return { message: String(data || 'Erro'), code: String(status), details: null, hint: null };
}

class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.params = new URLSearchParams();
    this.method = 'GET';
    this.body = undefined;
    this.headers = {};
    this.prefer = [];
    this.isSingle = false;
    this.isMaybe = false;
    this.countMode = null;
    this.headOnly = false;
  }
  select(cols = '*', opts = {}) {
    this.params.set('select', String(cols).replace(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g, ''));
    if (this.method !== 'GET') this.prefer.push('return=representation');
    if (opts.count) this.countMode = opts.count;
    if (opts.head) this.headOnly = true;
    return this;
  }
  insert(values, opts = {}) {
    this.method = 'POST';
    this.body = values;
    if (opts.count) this.countMode = opts.count;
    return this;
  }
  upsert(values, opts = {}) {
    this.method = 'POST';
    this.body = values;
    this.prefer.push(opts.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates');
    if (opts.onConflict) this.params.set('on_conflict', opts.onConflict);
    return this;
  }
  update(values) {
    this.method = 'PATCH';
    this.body = values;
    return this;
  }
  delete() {
    this.method = 'DELETE';
    return this;
  }
  _f(col, op, val) {
    this.params.append(col, `${op}.${val}`);
    return this;
  }
  eq(c, v) { return this._f(c, 'eq', v); }
  neq(c, v) { return this._f(c, 'neq', v); }
  gt(c, v) { return this._f(c, 'gt', v); }
  gte(c, v) { return this._f(c, 'gte', v); }
  lt(c, v) { return this._f(c, 'lt', v); }
  lte(c, v) { return this._f(c, 'lte', v); }
  like(c, v) { return this._f(c, 'like', v); }
  ilike(c, v) { return this._f(c, 'ilike', v); }
  is(c, v) { return this._f(c, 'is', v); }
  in(c, vals) {
    const list = vals.map((v) => (typeof v === 'string' && /[,()]/.test(v) ? `"${v}"` : v)).join(',');
    return this._f(c, 'in', `(${list})`);
  }
  contains(c, v) {
    return this._f(c, 'cs', Array.isArray(v) ? `{${v.join(',')}}` : typeof v === 'object' ? JSON.stringify(v) : v);
  }
  containedBy(c, v) {
    return this._f(c, 'cd', Array.isArray(v) ? `{${v.join(',')}}` : JSON.stringify(v));
  }
  not(c, op, v) { return this._f(c, `not.${op}`, v); }
  or(expr, opts = {}) {
    this.params.append(opts.foreignTable || opts.referencedTable ? `${opts.foreignTable || opts.referencedTable}.or` : 'or', `(${expr})`);
    return this;
  }
  filter(c, op, v) { return this._f(c, op, v); }
  match(obj) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  order(col, opts = {}) {
    const dir = opts.ascending === false ? 'desc' : 'asc';
    const nulls = opts.nullsFirst === undefined ? '' : opts.nullsFirst ? '.nullsfirst' : '.nullslast';
    const key = opts.foreignTable || opts.referencedTable ? `${opts.foreignTable || opts.referencedTable}.order` : 'order';
    const cur = this.params.get(key);
    this.params.set(key, (cur ? cur + ',' : '') + `${col}.${dir}${nulls}`);
    return this;
  }
  limit(n, opts = {}) {
    this.params.set(opts.foreignTable || opts.referencedTable ? `${opts.foreignTable || opts.referencedTable}.limit` : 'limit', String(n));
    return this;
  }
  range(from, to) {
    this.params.set('offset', String(from));
    this.params.set('limit', String(to - from + 1));
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }
  maybeSingle() {
    this.isMaybe = true;
    return this;
  }
  throwOnError() {
    this.throws = true;
    return this;
  }
  async _run() {
    const { db } = rt();
    const ctx = await ctxFor(this.client.key, this.client.authHeader);
    const prefer = [...this.prefer];
    if (this.countMode) prefer.push(`count=${this.countMode}`);
    if (this.method === 'POST' && !prefer.some((p) => p.startsWith('return='))) prefer.push('return=minimal');
    const headers = { 'Content-Type': 'application/json', Prefer: prefer.join(',') };
    if (this.isSingle) headers.Accept = 'application/vnd.pgrst.object+json';
    const url = `http://local/rest/v1/${this.table}?${this.params.toString()}`;
    const req = new Request(url, {
      method: this.headOnly ? 'HEAD' : this.method,
      headers,
      body: this.body === undefined ? undefined : JSON.stringify(this.body),
    });
    let res;
    try {
      res = await handleRest(req, new Db(db.d1, { uid: ctx.uid, role: ctx.role, service: ctx.service }), ctx, this.table);
    } catch (e) {
      const out = { data: null, error: errFrom(e.toJSON ? e.toJSON() : { message: e.message }, e.status || 500), count: null, status: e.status || 500 };
      if (this.throws) throw out.error;
      return out;
    }
    const text = res.status === 204 || this.headOnly ? '' : await res.text();
    let data = text ? JSON.parse(text) : null;
    let count = null;
    const cr = res.headers.get('Content-Range');
    if (cr && this.countMode) count = Number(cr.split('/')[1]) || 0;
    if (res.status >= 400) {
      if (this.isMaybe || (this.isSingle && false)) {
        // não acontece: maybeSingle é tratado abaixo sem cabeçalho de objeto
      }
      return { data: null, error: errFrom(data, res.status), count, status: res.status };
    }
    if (this.isMaybe) {
      if (Array.isArray(data) && data.length > 1) {
        return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${data.length} rows`, hint: null }, count, status: 406 };
      }
      data = Array.isArray(data) ? data[0] ?? null : data;
    }
    if (this.method !== 'GET' && !this.prefer.some((p) => p === 'return=representation')) data = null;
    return { data, error: null, count, status: res.status };
  }
  then(resolve, reject) {
    return this._run().then(resolve, reject);
  }
}

class Storage {
  constructor(client) {
    this.client = client;
  }
  from(bucket) {
    const self = this;
    const call = async (method, rest, body, headers = {}) => {
      const { env, db } = rt();
      const ctx = await ctxFor(self.client.key, self.client.authHeader);
      const req = new Request(`http://local/storage/v1/${rest}`, { method, headers, body });
      try {
        return await handleStorage(req, env, new Db(db.d1, ctx), ctx, rest);
      } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: e.status || 500 });
      }
    };
    return {
      async upload(path, file, opts = {}) {
        const body = file instanceof Blob ? await file.arrayBuffer() : file;
        const res = await call('POST', `object/${bucket}/${path}`, body, {
          'Content-Type': opts.contentType || (file && file.type) || 'application/octet-stream',
          'x-upsert': opts.upsert ? 'true' : 'false',
        });
        const data = await res.json().catch(() => null);
        return res.ok ? { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null } : { data: null, error: { message: data?.message || 'upload falhou' } };
      },
      async download(path) {
        const res = await call('GET', `object/${bucket}/${path}`);
        if (!res.ok) return { data: null, error: { message: 'Object not found' } };
        return { data: await res.blob(), error: null };
      },
      async createSignedUrl(path, expiresIn) {
        const res = await call('POST', `object/sign/${bucket}/${path}`, JSON.stringify({ expiresIn }), { 'Content-Type': 'application/json' });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: { message: data?.message || 'erro' } };
        return { data: { signedUrl: `${rt().env.PUBLIC_API_URL || ''}/storage/v1${data.signedURL}` }, error: null };
      },
      async remove(paths) {
        const res = await call('DELETE', `object/${bucket}`, JSON.stringify({ prefixes: paths }), { 'Content-Type': 'application/json' });
        return res.ok ? { data: await res.json(), error: null } : { data: null, error: { message: 'erro' } };
      },
      async list(prefix = '', opts = {}) {
        const res = await call('POST', `object/list/${bucket}`, JSON.stringify({ prefix, ...opts }), { 'Content-Type': 'application/json' });
        return res.ok ? { data: await res.json(), error: null } : { data: null, error: { message: 'erro' } };
      },
      getPublicUrl(path) {
        return { data: { publicUrl: `${rt().env.PUBLIC_API_URL || ''}/storage/v1/object/public/${bucket}/${path}` } };
      },
    };
  }
}

class Auth {
  constructor(client) {
    this.client = client;
    const db = () => new Db(rt().db.d1);
    this.admin = {
      async createUser({ email, password, user_metadata, email_confirm } = {}) {
        try {
          const user = await adminCreateUser(db(), { email, password, user_metadata });
          return { data: { user }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: e.message, status: e.status || 400 } };
        }
      },
      async updateUserById(id, attrs = {}) {
        try {
          const user = await adminUpdateUser(db(), id, attrs);
          return { data: { user }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: e.message, status: e.status || 400 } };
        }
      },
      async deleteUser(id) {
        await adminDeleteUser(db(), id);
        return { data: {}, error: null };
      },
      async getUserById(id) {
        const row = await db().first('SELECT * FROM auth_users WHERE id = ?', [id]);
        return row ? { data: { user: userObject(row) }, error: null } : { data: { user: null }, error: { message: 'User not found', status: 404 } };
      },
      async listUsers() {
        const rows = await db().all('SELECT * FROM auth_users ORDER BY created_at');
        return { data: { users: rows.map(userObject) }, error: null };
      },
    };
  }
  async getUser(jwt) {
    const { env, db } = rt();
    const header = jwt ? `Bearer ${jwt}` : this.client.authHeader;
    if (!header) return { data: { user: null }, error: { message: 'Auth session missing!', status: 401 } };
    let s = null;
    try {
      s = await sessionFromRequest(new Request('http://local/', { headers: { Authorization: header } }), env);
    } catch {
      s = null;
    }
    if (!s || !s.sub) return { data: { user: null }, error: { message: 'Invalid JWT', status: 401 } };
    const row = await db.first('SELECT * FROM auth_users WHERE id = ?', [s.sub]);
    if (!row) return { data: { user: null }, error: { message: 'User not found', status: 404 } };
    return { data: { user: userObject(row) }, error: null };
  }
  async getClaims(jwt) {
    const r = await this.getUser(jwt);
    return r.error ? { data: null, error: r.error } : { data: { claims: { sub: r.data.user.id, email: r.data.user.email } }, error: null };
  }
}

class Functions {
  constructor(client) {
    this.client = client;
  }
  async invoke(name, opts = {}) {
    const { env, db } = rt();
    const { handleFunction } = await import('../functions/index.js');
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this.client.authHeader && !headers.Authorization) headers.Authorization = this.client.authHeader;
    if (!headers.Authorization && this.client.key === env.SERVICE_ROLE_KEY) headers.Authorization = `Bearer ${env.SERVICE_ROLE_KEY}`;
    const res = await handleFunction(name, new Request(`http://local/functions/v1/${name}`, {
      method: opts.method || 'POST',
      headers,
      body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
    }), env, db);
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* texto */
    }
    return res.ok ? { data, error: null } : { data: null, error: { message: (data && data.error) || 'Function error', context: res } };
  }
}

export function createClient(url, key, options = {}) {
  const authHeader = options?.global?.headers?.Authorization || options?.global?.headers?.authorization || null;
  const client = { key, authHeader };
  client.from = (table) => new Query(client, table);
  client.rpc = async (fn, args = {}) => {
    const { env, db } = rt();
    const ctx = await ctxFor(key, authHeader);
    const { handleRpc } = await import('../rpc.js');
    try {
      const res = await handleRpc(new Request(`http://local/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }), env, new Db(db.d1, ctx), ctx, fn);
      return { data: await res.json(), error: null };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code } };
    }
  };
  client.auth = new Auth(client);
  client.storage = new Storage(client);
  client.functions = new Functions(client);
  return client;
}

export default { createClient };
