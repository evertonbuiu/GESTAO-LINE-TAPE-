// Importação dos dados do Supabase antigo.
//
// Fluxo:
//   POST /import/start   (administrador logado) -> cria um token de 3 horas
//                         e guarda a configuração (origem, ids trocados...)
//   POST /import/rows    {token, table, rows}   -> guarda as linhas numa área
//                         de espera (_import_rows); a ordem de chegada não importa
//   POST /import/files   {token, files}         -> baixa os arquivos públicos da
//                         origem (ou recebe o conteúdo em base64) e grava no R2
//   POST /import/apply   {token}                -> grava as linhas em partes:
//                         na primeira chamada guarda e desliga as regras
//                         automáticas e limpa as tabelas; depois grava na ordem
//                         das chaves estrangeiras; no fim religa as regras.
//
// As regras automáticas ficam desligadas durante a gravação para nada ser
// lançado em dobro (vales, estoque, histórico): os dados já vêm prontos.
import { SCHEMA } from './generated/schema.js';
import { toDb } from './rest.js';
import { ApiError, json, readJson, randomToken } from './util.js';

const KEEP_TABLES = new Set(['user_credentials', 'user_roles', 'profiles', 'user_permissions', 'user_theme_preferences']);
const CHUNK = 120;

async function getSetting(db, k) {
  const r = await db.d1.prepare('SELECT v FROM _settings WHERE k = ?').bind(k).first();
  return r ? r.v : null;
}

async function setSetting(db, k, v) {
  await db.d1.prepare('INSERT INTO _settings (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v').bind(k, v).run();
}

async function delSetting(db, k) {
  await db.d1.prepare('DELETE FROM _settings WHERE k = ?').bind(k).run();
}

async function loadConfig(db, token) {
  const raw = await getSetting(db, 'import_config');
  if (!raw) throw new ApiError(403, 'import_closed', 'Nenhuma importação aberta');
  const cfg = JSON.parse(raw);
  if (!token || token !== cfg.token || Date.now() > cfg.exp) throw new ApiError(403, 'import_token', 'Token de importação inválido ou vencido');
  return cfg;
}

/** Ordem das tabelas: quem é referenciado vem antes. */
function tableOrder() {
  const names = Object.keys(SCHEMA);
  const deps = new Map(names.map((t) => [t, new Set((SCHEMA[t].fks || []).map((f) => f.ref).filter((r) => r !== t && SCHEMA[r]))]));
  const out = [];
  const seen = new Set();
  const visit = (t, stack = new Set()) => {
    if (seen.has(t)) return;
    if (stack.has(t)) return; // ciclo: segue sem esperar
    stack.add(t);
    for (const d of deps.get(t) || []) visit(d, stack);
    stack.delete(t);
    seen.add(t);
    out.push(t);
  };
  for (const t of names.sort()) visit(t);
  return out;
}

function deepFix(v, cfg) {
  if (typeof v === 'string') {
    let s = cfg.remap && Object.prototype.hasOwnProperty.call(cfg.remap, v) ? cfg.remap[v] : v;
    for (const [from, to] of cfg.replace || []) if (s.includes(from)) s = s.split(from).join(to);
    return s;
  }
  if (Array.isArray(v)) return v.map((x) => deepFix(x, cfg));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = deepFix(x, cfg);
    return o;
  }
  return v;
}

function buildInsert(table, row, cfg, unknown) {
  const meta = SCHEMA[table];
  const cols = [];
  const vals = [];
  for (const [k, raw] of Object.entries(row)) {
    const c = meta.cols[k];
    if (!c) {
      unknown.add(`${table}.${k}`);
      continue;
    }
    if (c.g) continue; // coluna calculada
    cols.push(`"${k}"`);
    vals.push(toDb(c, deepFix(raw, cfg), k));
  }
  return {
    sql: `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
    params: vals,
  };
}

async function start(request, db, ctx) {
  if (!ctx.uid || !ctx.roles?.has('admin')) throw new ApiError(403, '42501', 'Somente administrador');
  const body = (await readJson(request)) || {};
  const state = await getSetting(db, 'import_state');
  if (state && JSON.parse(state).phase === 'applying') throw new ApiError(409, 'import_busy', 'Há uma importação em andamento');
  const cfg = {
    token: randomToken(24),
    exp: Date.now() + 3 * 3600 * 1000,
    source: String(body.source || ''),
    remap: body.remap || {},
    skipUsers: body.skipUsers || [],
    replace: body.replace || [],
  };
  await db.d1.batch([
    db.d1.prepare('DELETE FROM _import_rows'),
    db.d1.prepare("DELETE FROM _settings WHERE k IN ('import_state', 'import_errors')"),
  ]);
  await setSetting(db, 'import_config', JSON.stringify(cfg));
  return json({ token: cfg.token, expires: new Date(cfg.exp).toISOString() });
}

async function stageRows(request, db) {
  const body = (await readJson(request)) || {};
  await loadConfig(db, body.token);
  const table = String(body.table || '');
  if (table !== '__auth_users' && table !== '__sequences' && !SCHEMA[table]) throw new ApiError(400, 'import_table', `Tabela desconhecida: ${table}`);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const stmts = rows.map((r) => db.d1.prepare('INSERT INTO _import_rows (tbl, data) VALUES (?, ?)').bind(table, JSON.stringify(r)));
  for (let i = 0; i < stmts.length; i += 80) await db.d1.batch(stmts.slice(i, i + 80));
  return json({ staged: rows.length, table });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importFiles(request, env, db) {
  const body = (await readJson(request)) || {};
  const cfg = await loadConfig(db, body.token);
  const files = Array.isArray(body.files) ? body.files.slice(0, 20) : [];
  const ok = [];
  const failed = [];
  for (const f of files) {
    const bucket = String(f.bucket || '');
    const name = String(f.name || '');
    if (!bucket || !name || name.includes('..')) {
      failed.push({ name, error: 'nome inválido' });
      continue;
    }
    let bytes;
    let type = f.mimetype || 'application/octet-stream';
    if (f.content_b64) {
      bytes = b64ToBytes(f.content_b64);
    } else {
      const url = `${cfg.source}/storage/v1/object/public/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) {
        failed.push({ bucket, name, error: `HTTP ${res.status}` });
        continue;
      }
      bytes = new Uint8Array(await res.arrayBuffer());
      type = f.mimetype || res.headers.get('content-type') || type;
    }
    await env.FILES.put(`${bucket}/${name}`, bytes, { httpMetadata: { contentType: type } });
    const owner = f.owner ? deepFix(String(f.owner), cfg) : null;
    await db.d1
      .prepare(
        `INSERT INTO storage_objects (bucket_id, name, content_type, size, owner, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%f+00:00','now')), strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))
         ON CONFLICT (bucket_id, name) DO UPDATE SET content_type = excluded.content_type, size = excluded.size, owner = excluded.owner`,
      )
      .bind(bucket, name, type, bytes.byteLength, owner, f.created_at || null)
      .run();
    ok.push(`${bucket}/${name}`);
  }
  return json({ ok: ok.length, failed });
}

async function addErrors(db, list) {
  if (!list.length) return;
  const cur = JSON.parse((await getSetting(db, 'import_errors')) || '[]');
  await setSetting(db, 'import_errors', JSON.stringify(cur.concat(list).slice(-300)));
}

async function apply(request, db) {
  const body = (await readJson(request)) || {};
  const cfg = await loadConfig(db, body.token);
  let state = JSON.parse((await getSetting(db, 'import_state')) || '{"phase":"new"}');
  const order = tableOrder();

  if (state.phase === 'new') {
    // 1) guarda e desliga as regras automáticas (menos as de atualização de telas)
    const trig = await db.d1.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name NOT LIKE '\\_rt\\_%' ESCAPE '\\'").all();
    const saved = (await getSetting(db, 'import_triggers')) || JSON.stringify(trig.results);
    await setSetting(db, 'import_triggers', saved);
    const drops = trig.results.map((t) => db.d1.prepare(`DROP TRIGGER IF EXISTS "${t.name}"`));
    for (let i = 0; i < drops.length; i += 50) await db.d1.batch(drops.slice(i, i + 50));
    // 2) limpa as tabelas que serão importadas (na ordem inversa)
    const wipe = [...order].reverse().filter((t) => !KEEP_TABLES.has(t));
    const dels = wipe.map((t) => db.d1.prepare(`DELETE FROM "${t}"`));
    for (let i = 0; i < dels.length; i += 50) await db.d1.batch(dels.slice(i, i + 50));
    state = { phase: 'applying', triggers: trig.results.length };
    await setSetting(db, 'import_state', JSON.stringify(state));
    return json({ phase: state.phase, message: `regras desligadas: ${trig.results.length}; tabelas limpas: ${wipe.length}` });
  }

  if (state.phase === 'applying') {
    const rank = ['__auth_users', '__sequences', ...order];
    const caseSql = `CASE tbl ${rank.map((t, i) => `WHEN '${t}' THEN ${i}`).join(' ')} ELSE 9999 END`;
    const batch = await db.d1.prepare(`SELECT id, tbl, data FROM _import_rows ORDER BY ${caseSql}, id LIMIT ${CHUNK}`).all();
    const rows = batch.results;
    if (rows.length) {
      // não mistura tabelas de níveis diferentes num mesmo lote
      const first = rows[0].tbl;
      const same = rows.filter((r) => r.tbl === first);
      const unknown = new Set();
      const stmts = [];
      const errors = [];
      for (const r of same) {
        const data = JSON.parse(r.data);
        try {
          if (first === '__sequences') {
            stmts.push({
              sql: 'INSERT INTO _sequences (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value',
              params: [String(data.name), Number(data.value)],
            });
          } else if (first === '__auth_users') {
            if ((cfg.skipUsers || []).includes(data.id)) continue;
            stmts.push({
              // sem senha: o administrador define uma nova na tela Usuários
              sql: `INSERT INTO auth_users (id, email, password_hash, raw_user_meta_data, created_at, updated_at)
                    VALUES (?, ?, '', ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%f+00:00','now')), COALESCE(?, strftime('%Y-%m-%dT%H:%M:%f+00:00','now')))
                    ON CONFLICT DO NOTHING`,
              params: [data.id, String(data.email || '').toLowerCase(), JSON.stringify(data.meta || {}), data.created_at || null, data.created_at || null],
            });
          } else {
            stmts.push(buildInsert(first, data, cfg, unknown));
          }
        } catch (e) {
          errors.push({ table: first, id: data.id, error: String(e.message || e) });
        }
      }
      try {
        if (stmts.length) await db.d1.batch(stmts.map((s) => db.d1.prepare(s.sql).bind(...s.params)));
      } catch (e) {
        // lote falhou: grava um a um para achar a linha com problema
        for (const s of stmts) {
          try {
            await db.d1.prepare(s.sql).bind(...s.params).run();
          } catch (e2) {
            errors.push({ table: first, sql: s.sql.slice(0, 80), id: s.params[0], error: String(e2.message || e2).slice(0, 200) });
          }
        }
      }
      if (unknown.size) errors.push({ table: first, aviso: 'colunas ignoradas', cols: [...unknown] });
      await addErrors(db, errors);
      const ids = same.map((r) => r.id);
      await db.d1.prepare(`DELETE FROM _import_rows WHERE id IN (${ids.join(',')})`).run();
      const left = await db.d1.prepare('SELECT COUNT(*) AS n FROM _import_rows').first();
      return json({ phase: 'applying', table: first, written: stmts.length, errors: errors.length, remaining: left.n });
    }
    // 3) terminou: religa as regras
    const saved = JSON.parse((await getSetting(db, 'import_triggers')) || '[]');
    const creates = saved.map((t) => db.d1.prepare(t.sql));
    for (let i = 0; i < creates.length; i += 50) await db.d1.batch(creates.slice(i, i + 50));
    await setSetting(db, 'import_state', JSON.stringify({ phase: 'done', at: new Date().toISOString() }));
    await delSetting(db, 'import_triggers');
    await delSetting(db, 'import_config');
    const errs = JSON.parse((await getSetting(db, 'import_errors')) || '[]');
    return json({ phase: 'done', triggers_restored: creates.length, errors: errs });
  }

  return json({ phase: state.phase });
}

export async function handleImport(op, request, env, db, ctx) {
  if (request.method !== 'POST') throw new ApiError(405, 'method', 'Use POST');
  if (op === 'start') return start(request, db, ctx);
  if (op === 'rows') return stageRows(request, db);
  if (op === 'files') return importFiles(request, env, db);
  if (op === 'apply') return apply(request, db);
  if (op === 'errors') {
    const body = (await readJson(request)) || {};
    await loadConfig(db, body.token);
    return json(JSON.parse((await getSetting(db, 'import_errors')) || '[]'));
  }
  throw new ApiError(404, 'not_found', 'Operação de importação desconhecida');
}
