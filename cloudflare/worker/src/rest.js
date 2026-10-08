// API de dados compatível com o PostgREST (o que o supabase-js usa em
// supabase.from(...)), implementada sobre o SQLite do Cloudflare D1.
//
// Suporta: select com colunas, apelidos e tabelas relacionadas (muitos-para-um
// e um-para-muitos, com !inner e dicas), filtros eq/neq/gt/gte/lt/lte/like/
// ilike/is/in/cs/cd/ov/not, or/and aninhados, filtros em tabela relacionada,
// order, limit/offset/Range, count=exact, single/maybeSingle, insert em lote,
// upsert (on_conflict, merge/ignore), update e delete com retorno.
import { SCHEMA, SOFT_CHECKS } from './generated/schema.js';
import { ApiError, json } from './util.js';
import { policyFor, checkWrite } from './policies.js';
import { afterWrite } from './realtime.js';
import { beforeInsert, beforeUpdate, needsPerRowUpdate, perRowPatch } from './rules/hooks.js';
import { POST_SYNC_TABLES } from './generated/hooks.js';
import { syncBankTransactionsSql } from './rules/bank.js';

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const q = (n) => '"' + String(n).replace(/"/g, '""') + '"';

export function tableMeta(name) {
  const t = SCHEMA[name];
  if (!t) {
    throw new ApiError(
      404,
      'PGRST205',
      `Could not find the table 'public.${name}' in the schema cache`,
    );
  }
  return t;
}

// ---------------------------------------------------------------------------
// Conversão de valores (PostgreSQL <-> SQLite)
// ---------------------------------------------------------------------------

function hasTz(s) {
  return /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s);
}

export function normTs(v) {
  if (v == null || v === '') return v === '' ? null : v;
  if (v instanceof Date) return v.toISOString().replace('Z', '+00:00');
  let s = String(v).trim();
  if (/^(now|today)$/i.test(s)) return new Date().toISOString().replace('Z', '+00:00');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00Z';
  s = s.replace(' ', 'T');
  if (!hasTz(s)) s += 'Z';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, '22007', `invalid input syntax for type timestamp with time zone: "${v}"`);
  return d.toISOString().replace('Z', '+00:00');
}

function normTsLocal(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + 'T00:00:00';
  return s.replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');
}

export function normDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    if (hasTz(s.replace(' ', 'T'))) return normTs(s).slice(0, 10);
    return s.slice(0, 10);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, '22007', `invalid input syntax for type date: "${v}"`);
  return d.toISOString().slice(0, 10);
}

function pgArrayLiteral(s) {
  // '{a,b,"c d"}' -> ['a','b','c d']
  const inner = s.trim().replace(/^\{|\}$/g, '');
  if (!inner) return [];
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' && inner[i - 1] !== '\\') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((x) => (x === 'NULL' ? null : x));
}

/** Valor vindo do app -> valor gravado no SQLite. */
export function toDb(col, v, colName = '') {
  if (v === undefined) return undefined;
  if (v === null) return null;
  switch (col.t) {
    case 'bool':
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v === 1 || v === 0) return v;
      if (/^(true|t|1|yes|on)$/i.test(String(v))) return 1;
      if (/^(false|f|0|no|off)$/i.test(String(v))) return 0;
      throw new ApiError(400, '22P02', `invalid input syntax for type boolean: "${v}"`);
    case 'int': {
      if (v === '') throw new ApiError(400, '22P02', `invalid input syntax for type integer: ""`);
      const n = Number(v);
      if (!Number.isFinite(n)) throw new ApiError(400, '22P02', `invalid input syntax for type integer: "${v}"`);
      return Math.round(n);
    }
    case 'num': {
      if (v === '') throw new ApiError(400, '22P02', `invalid input syntax for type numeric: ""`);
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n)) throw new ApiError(400, '22P02', `invalid input syntax for type numeric: "${v}"`);
      return col.s != null ? roundTo(n, col.s) : n;
    }
    case 'json':
      return JSON.stringify(v);
    case 'array': {
      let arr = v;
      if (typeof v === 'string') arr = v.trim().startsWith('[') ? JSON.parse(v) : pgArrayLiteral(v);
      if (!Array.isArray(arr)) throw new ApiError(400, '22P02', `malformed array literal: "${v}"`);
      if (col.et === 'int' || col.et === 'num') arr = arr.map((x) => (x == null ? null : Number(x)));
      return JSON.stringify(arr);
    }
    case 'ts':
      return normTs(v);
    case 'tsl':
      return normTsLocal(v);
    case 'date':
      return normDate(v);
    case 'uuid': {
      const s = String(v);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        throw new ApiError(400, '22P02', `invalid input syntax for type uuid: "${s}"`);
      }
      return s.toLowerCase();
    }
    default:
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
}

function roundTo(n, s) {
  const f = 10 ** s;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Valor do SQLite -> JSON igual ao que o PostgREST devolveria. */
export function fromDb(col, v) {
  if (v == null) return null;
  switch (col.t) {
    case 'bool':
      return v === 1 || v === true || v === '1';
    case 'int':
      return typeof v === 'number' ? v : Number(v);
    case 'num': {
      const n = typeof v === 'number' ? v : Number(v);
      return col.s != null ? roundTo(n, col.s) : Math.round(n * 1e10) / 1e10;
    }
    case 'json':
    case 'array':
      if (typeof v !== 'string') return v;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    default:
      return v;
  }
}

export function rowFromDb(meta, row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const c = meta.cols[k];
    out[k] = c ? fromDb(c, v) : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parser do parâmetro select
// ---------------------------------------------------------------------------

function splitTop(s, sep = ',') {
  const out = [];
  let depth = 0;
  let cur = '';
  let inQ = false;
  for (const c of s) {
    if (c === '"') inQ = !inQ;
    if (!inQ) {
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === sep && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x !== '');
}

/**
 * Retorna { cols: [{name, alias, cast}], embeds: [{alias, rel, hint, inner, spread, sel}], star }
 */
export function parseSelect(str) {
  const sel = { cols: [], embeds: [], star: false };
  if (!str || str.trim() === '' || str.trim() === '*') {
    sel.star = true;
    return sel;
  }
  for (let part of splitTop(str)) {
    part = part.replace(/\s+/g, ' ').trim();
    const open = part.indexOf('(');
    if (open > 0 && part.endsWith(')')) {
      let head = part.slice(0, open).trim();
      const inner = part.slice(open + 1, -1);
      let spread = false;
      if (head.startsWith('...')) {
        spread = true;
        head = head.slice(3);
      }
      let alias = null;
      const ci = head.indexOf(':');
      if (ci > 0) {
        alias = head.slice(0, ci).trim();
        head = head.slice(ci + 1).trim();
      }
      const bits = head.split('!');
      const rel = bits[0].trim();
      let hint = null;
      let inner_ = false;
      for (const b of bits.slice(1)) {
        if (b === 'inner') inner_ = true;
        else if (b === 'left') inner_ = false;
        else hint = b;
      }
      // agregados do tipo count() não são usados pelo app
      sel.embeds.push({ alias: alias || rel, rel, hint, inner: inner_, spread, sel: parseSelect(inner) });
      continue;
    }
    if (part === '*') {
      sel.star = true;
      continue;
    }
    let alias = null;
    let name = part;
    const ci = part.indexOf(':');
    if (ci > 0 && part[ci + 1] !== ':') {
      alias = part.slice(0, ci).trim();
      name = part.slice(ci + 1).trim();
    }
    let cast = null;
    const cc = name.indexOf('::');
    if (cc > 0) {
      cast = name.slice(cc + 2).trim();
      name = name.slice(0, cc).trim();
    }
    name = name.replace(/^"|"$/g, '');
    sel.cols.push({ name, alias: alias || name, cast });
  }
  return sel;
}

// ---------------------------------------------------------------------------
// Relações (embeds)
// ---------------------------------------------------------------------------

function resolveRelation(parent, embed) {
  const pm = tableMeta(parent);
  const candidates = [];
  // muitos-para-um: parent.fk -> rel
  for (const fk of pm.fks) {
    const matchName = fk.ref === embed.rel;
    const matchCol = fk.cols.length === 1 && fk.cols[0] === embed.rel;
    if (!matchName && !matchCol) continue;
    if (embed.hint && embed.hint !== fk.name && !(fk.cols.length === 1 && fk.cols[0] === embed.hint) && embed.hint !== fk.ref) continue;
    candidates.push({ kind: 'one', table: fk.ref, localCols: fk.cols, remoteCols: fk.refCols, fk: fk.name });
  }
  // um-para-muitos: rel.fk -> parent
  const rm = SCHEMA[embed.rel];
  if (rm) {
    for (const fk of rm.fks) {
      if (fk.ref !== parent) continue;
      if (embed.hint && embed.hint !== fk.name && !(fk.cols.length === 1 && fk.cols[0] === embed.hint)) continue;
      // se a FK do filho é também chave única, vira um-para-um
      const unique = (rm.uniques || []).some((u) => u.length === fk.cols.length && u.every((c) => fk.cols.includes(c)));
      candidates.push({ kind: unique ? 'one' : 'many', table: embed.rel, localCols: fk.refCols, remoteCols: fk.cols, fk: fk.name });
    }
  }
  if (candidates.length === 0) {
    throw new ApiError(
      400,
      'PGRST200',
      `Could not find a relationship between '${parent}' and '${embed.rel}' in the schema cache`,
    );
  }
  // Mais de uma relação possível: o PostgREST exigiria dica (!fk). Para não
  // quebrar telas, usa a primeira FK cujo nome de coluna lembra a tabela.
  if (candidates.length > 1) {
    const base = embed.rel.replace(/s$/, '');
    const pref = candidates.find((c) => c.localCols.some((x) => x === `${base}_id` || x === embed.rel));
    return pref || candidates[0];
  }
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function parseList(s) {
  // (a,b,"c,d") -> ['a','b','c,d']
  const inner = s.trim().replace(/^\(|\)$/g, '');
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === '\\' && inQ) {
      cur += inner[++i];
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (inner.length) out.push(cur);
  return out;
}

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'imatch', 'is', 'isdistinct', 'in', 'cs', 'cd', 'ov', 'fts', 'plfts', 'phfts', 'wfts']);

/** Converte "op.valor" em nó de filtro. */
function parseOpValue(column, expr) {
  let negate = false;
  let rest = expr;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf('.');
  let op = dot < 0 ? rest : rest.slice(0, dot);
  let value = dot < 0 ? '' : rest.slice(dot + 1);
  let modifier = null;
  const m = op.match(/^(\w+)\((any|all)\)$/);
  if (m) {
    op = m[1];
    modifier = m[2];
  }
  if (!OPS.has(op)) throw new ApiError(400, 'PGRST100', `"failed to parse filter (${expr})" (line 1, column 1)`);
  return { type: 'cond', column, op, value, negate, modifier };
}

/** or=(a.eq.1,and(b.eq.2,c.gt.3)) */
function parseLogic(kind, body, negate = false) {
  const inner = body.trim().replace(/^\(/, '').replace(/\)$/, '');
  const children = [];
  for (const part of splitTop(inner)) {
    const m = part.match(/^(not\.)?(and|or)\((.*)\)$/s);
    if (m) {
      children.push(parseLogic(m[2], '(' + m[3] + ')', !!m[1]));
      continue;
    }
    const d = part.indexOf('.');
    const col = part.slice(0, d);
    children.push(parseOpValue(col, part.slice(d + 1)));
  }
  return { type: kind, children, negate };
}

/**
 * Lê os filtros da URL. Retorna { root: [nós], embedded: {rel: [nós]} }
 */
export function parseFilters(params) {
  const root = [];
  const embedded = {};
  const order = { root: null, embedded: {} };
  const limits = { embedded: {} };
  for (const [key, val] of params.entries()) {
    if (RESERVED.has(key)) continue;
    const parts = key.split('.');
    const last = parts[parts.length - 1];
    const path = parts.slice(0, -1).join('.');
    if (last === 'order' && path) {
      order.embedded[path] = val;
      continue;
    }
    if ((last === 'limit' || last === 'offset') && path) {
      (limits.embedded[path] ||= {})[last] = Number(val);
      continue;
    }
    let node;
    if (last === 'or' || last === 'and' || (last === 'not' && false)) {
      node = parseLogic(last, val);
    } else if (key.endsWith('not.or') || key.endsWith('not.and')) {
      node = parseLogic(last, val, true);
    } else {
      node = parseOpValue(last, val);
    }
    const target = path.replace(/\.not$/, '');
    if (target) (embedded[target] ||= []).push(node);
    else root.push(node);
  }
  return { root, embedded, order, limits };
}

function coerceFilterValue(col, v) {
  if (v == null) return v;
  if (!col) return v;
  switch (col.t) {
    case 'bool':
      return /^(true|t|1)$/i.test(v) ? 1 : 0;
    case 'int':
    case 'num': {
      const n = Number(v);
      if (v === '' || !Number.isFinite(n)) throw new ApiError(400, '22P02', `invalid input syntax for type numeric: "${v}"`);
      return n;
    }
    case 'ts':
      return normTs(v);
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : normDate(v);
    case 'uuid':
      return String(v).toLowerCase();
    default:
      return v;
  }
}

function likeToGlob(p) {
  return p.replace(/[[\]?*]/g, (c) => `[${c}]`).replace(/%/g, '*').replace(/_/g, '?');
}

/** Gera SQL para um nó de filtro. */
function condSql(meta, alias, node, params) {
  if (node.type === 'and' || node.type === 'or') {
    const parts = node.children.map((c) => condSql(meta, alias, c, params)).filter(Boolean);
    if (!parts.length) return null;
    const s = '(' + parts.join(node.type === 'and' ? ' AND ' : ' OR ') + ')';
    return node.negate ? `NOT ${s}` : s;
  }
  const col = meta.cols[node.column];
  let ref;
  let jsonPath = null;
  if (!col) {
    // json: data->>chave
    const m = node.column.match(/^([a-z_0-9]+)(->>?)(.+)$/i);
    if (m && meta.cols[m[1]]) {
      jsonPath = m[3].split(/->>?/).map((k) => k.replace(/^'|'$/g, ''));
      ref = `json_extract(${alias}.${q(m[1])}, '$.${jsonPath.join('.')}')`;
    } else {
      throw new ApiError(400, '42703', `column ${meta.name || ''}.${node.column} does not exist`);
    }
  } else {
    ref = `${alias}.${q(node.column)}`;
  }
  const c = jsonPath ? null : col;
  let s;
  const v = node.value;
  switch (node.op) {
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[node.op];
      if (node.modifier) {
        const list = parseList(v.startsWith('{') ? '(' + v.slice(1, -1) + ')' : v);
        const ps = list.map((x) => {
          params.push(coerceFilterValue(c, x));
          return `${ref} ${sym} ?`;
        });
        s = '(' + ps.join(node.modifier === 'any' ? ' OR ' : ' AND ') + ')';
      } else {
        params.push(coerceFilterValue(c, v));
        s = c && c.t === 'text' && (node.op !== 'eq' && node.op !== 'neq') ? `${ref} ${sym} ?` : `${ref} ${sym} ?`;
      }
      break;
    }
    case 'like':
    case 'ilike': {
      const pat = v.replace(/\*/g, '%');
      if (node.modifier) {
        const list = parseList(pat.startsWith('{') ? '(' + pat.slice(1, -1) + ')' : pat);
        const ps = list.map((x) => {
          if (node.op === 'ilike') {
            params.push(x);
            return `lower(${ref}) LIKE lower(?)`;
          }
          params.push(likeToGlob(x));
          return `${ref} GLOB ?`;
        });
        s = '(' + ps.join(node.modifier === 'any' ? ' OR ' : ' AND ') + ')';
      } else if (node.op === 'ilike') {
        params.push(pat);
        s = `lower(${ref}) LIKE lower(?)`;
      } else {
        params.push(likeToGlob(pat));
        s = `${ref} GLOB ?`;
      }
      break;
    }
    case 'match':
    case 'imatch':
      params.push(v);
      s = `${ref} LIKE '%' || ? || '%'`;
      break;
    case 'is': {
      const lv = v.toLowerCase();
      if (lv === 'null') s = `${ref} IS NULL`;
      else if (lv === 'true') s = `${ref} = 1`;
      else if (lv === 'false') s = `${ref} = 0`;
      else if (lv === 'unknown') s = `${ref} IS NULL`;
      else throw new ApiError(400, 'PGRST100', `failed to parse filter (is.${v})`);
      break;
    }
    case 'isdistinct':
      params.push(coerceFilterValue(c, v));
      s = `${ref} IS NOT ?`;
      break;
    case 'in': {
      const list = parseList(v);
      if (!list.length) {
        s = '0';
        break;
      }
      // O D1 aceita no máximo 100 parâmetros por consulta: listas grandes
      // vão como valores literais (escapados).
      if (list.length > 40) {
        const lits = list.map((x) => {
          const v = coerceFilterValue(c, x);
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          return "'" + String(v).replace(/'/g, "''") + "'";
        });
        s = `${ref} IN (${lits.join(',')})`;
        break;
      }
      const ph = list.map((x) => {
        params.push(coerceFilterValue(c, x));
        return '?';
      });
      s = `${ref} IN (${ph.join(',')})`;
      break;
    }
    case 'cs':
    case 'cd':
    case 'ov': {
      // arrays (texto JSON) e objetos JSON
      let vals;
      if (v.startsWith('{') && !v.startsWith('{"') && c && c.t === 'array') vals = pgArrayLiteral(v);
      else if (v.startsWith('[') || v.startsWith('{')) vals = JSON.parse(v);
      else vals = parseList(v);
      if (Array.isArray(vals)) {
        if (node.op === 'cs') {
          s = vals.length
            ? '(' + vals.map((x) => {
                params.push(x);
                return `EXISTS (SELECT 1 FROM json_each(${ref}) WHERE value = ?)`;
              }).join(' AND ') + ')'
            : '1';
        } else if (node.op === 'ov') {
          s = vals.length
            ? '(' + vals.map((x) => {
                params.push(x);
                return `EXISTS (SELECT 1 FROM json_each(${ref}) WHERE value = ?)`;
              }).join(' OR ') + ')'
            : '0';
        } else {
          params.push(JSON.stringify(vals));
          s = `NOT EXISTS (SELECT 1 FROM json_each(${ref}) WHERE value NOT IN (SELECT value FROM json_each(?)))`;
        }
      } else {
        // objeto: cada chave precisa bater
        const keys = Object.keys(vals);
        s = keys.length
          ? '(' + keys.map((k) => {
              params.push(typeof vals[k] === 'object' ? JSON.stringify(vals[k]) : vals[k]);
              return `json_extract(${ref}, '$.${k.replace(/'/g, "''")}') = ?`;
            }).join(' AND ') + ')'
          : '1';
      }
      break;
    }
    case 'fts':
    case 'plfts':
    case 'phfts':
    case 'wfts': {
      const words = v.replace(/^\w+\./, '').split(/[\s&|]+/).filter(Boolean);
      s = words.length
        ? '(' + words.map((w) => {
            params.push(w.replace(/'/g, ''));
            return `lower(${ref}) LIKE '%' || lower(?) || '%'`;
          }).join(' AND ') + ')'
        : '1';
      break;
    }
    default:
      throw new ApiError(400, 'PGRST100', `operador não suportado: ${node.op}`);
  }
  return node.negate ? `NOT (${s})` : s;
}

function whereSql(meta, alias, nodes, params) {
  const parts = nodes.map((n) => condSql(meta, alias, n, params)).filter(Boolean);
  return parts.length ? parts.join(' AND ') : null;
}

function orderSql(meta, alias, orderStr) {
  if (!orderStr) return '';
  const parts = splitTop(orderStr).map((p) => {
    const bits = p.split('.');
    const colName = bits[0];
    if (!meta.cols[colName]) {
      throw new ApiError(400, '42703', `column ${colName} does not exist`);
    }
    const dir = bits.includes('desc') ? 'DESC' : 'ASC';
    let nulls = dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST';
    if (bits.includes('nullsfirst')) nulls = 'NULLS FIRST';
    if (bits.includes('nullslast')) nulls = 'NULLS LAST';
    const coll = meta.cols[colName].t === 'text' ? ' COLLATE NOCASE' : '';
    return `${alias}.${q(colName)}${coll} ${dir} ${nulls}`;
  });
  return parts.length ? ' ORDER BY ' + parts.join(', ') : '';
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Monta as condições EXISTS para embeds !inner (e filtros neles), para que o
 * filtro aconteça no SQL e não atrapalhe limit/count.
 */
function innerEmbedConds(table, alias, sel, filters, params, ctx, prefix = '', depth = 0) {
  const conds = [];
  for (const e of sel.embeds) {
    const path = prefix ? `${prefix}.${e.alias}` : e.alias;
    const efilters = filters.embedded[path] || filters.embedded[e.rel] || [];
    if (!e.inner) continue;
    const rel = resolveRelation(table, e);
    const rmeta = tableMeta(rel.table);
    const ra = `e${depth}_${conds.length}`;
    const join = rel.localCols.map((lc, i) => `${ra}.${q(rel.remoteCols[i])} = ${alias}.${q(lc)}`).join(' AND ');
    const sub = [join];
    const pol = policyFor(ctx, rel.table, 'select');
    if (pol.deny) {
      conds.push('0');
      continue;
    }
    if (pol.where) {
      sub.push(pol.where.sql.replaceAll('$T', ra));
      params.push(...pol.where.params);
    }
    const w = whereSql(rmeta, ra, efilters, params);
    if (w) sub.push(w);
    const nested = innerEmbedConds(rel.table, ra, e.sel, filters, params, ctx, path, depth + 1);
    sub.push(...nested);
    conds.push(`EXISTS (SELECT 1 FROM ${q(rel.table)} ${ra} WHERE ${sub.join(' AND ')})`);
  }
  return conds;
}

function project(meta, sel, row) {
  if (sel.star && !sel.cols.length) return { ...row };
  const out = sel.star ? { ...row } : {};
  for (const c of sel.cols) {
    if (!(c.name in meta.cols)) {
      const m = c.name.match(/^([a-z_0-9]+)(->>?)(.+)$/i);
      if (m && meta.cols[m[1]]) {
        let val = row[m[1]];
        for (const k of m[3].split(/->>?/)) val = val == null ? null : val[k.replace(/^'|'$/g, '')];
        out[c.alias] = m[2] === '->>' && val != null && typeof val === 'object' ? JSON.stringify(val) : val;
        continue;
      }
      throw new ApiError(400, '42703', `column ${c.name} does not exist`);
    }
    let v = row[c.name];
    if (c.cast === 'text' && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if ((c.cast === 'int' || c.cast === 'integer' || c.cast === 'numeric' || c.cast === 'float8') && v != null) v = Number(v);
    out[c.alias] = v;
  }
  return out;
}

/** Busca os embeds (em lote, por IN) e encaixa nas linhas já convertidas. */
async function attachEmbeds(db, ctx, table, sel, filters, rawRows, outRows, prefix = '') {
  for (const e of sel.embeds) {
    const path = prefix ? `${prefix}.${e.alias}` : e.alias;
    const rel = resolveRelation(table, e);
    const rmeta = tableMeta(rel.table);
    const efilters = filters.embedded[path] || filters.embedded[e.rel] || [];
    const pol = policyFor(ctx, rel.table, 'select');
    const keys = new Map();
    rawRows.forEach((r, i) => {
      const k = rel.localCols.map((c) => r[c]);
      if (k.some((x) => x == null)) return;
      const ks = JSON.stringify(k);
      if (!keys.has(ks)) keys.set(ks, []);
      keys.get(ks).push(i);
    });
    let children = [];
    if (keys.size && !pol.deny) {
      const all = [...keys.keys()].map((k) => JSON.parse(k));
      const CHUNK = 40;
      for (let i = 0; i < all.length; i += CHUNK) {
        const chunk = all.slice(i, i + CHUNK);
        const params = [];
        let w;
        if (rel.remoteCols.length === 1) {
          w = `t.${q(rel.remoteCols[0])} IN (${chunk.map((k) => {
            params.push(k[0]);
            return '?';
          }).join(',')})`;
        } else {
          w = '(' + chunk.map((k) => '(' + rel.remoteCols.map((c, j) => {
            params.push(k[j]);
            return `t.${q(c)} = ?`;
          }).join(' AND ') + ')').join(' OR ') + ')';
        }
        const conds = [w];
        if (pol.where) {
          conds.push(pol.where.sql.replaceAll('$T', 't'));
          params.push(...pol.where.params);
        }
        const fw = whereSql(rmeta, 't', efilters, params);
        if (fw) conds.push(fw);
        conds.push(...innerEmbedConds(rel.table, 't', e.sel, filters, params, ctx, path, 1));
        const ord = orderSql(rmeta, 't', filters.order.embedded[path]);
        const rows = await db.all(`SELECT t.* FROM ${q(rel.table)} t WHERE ${conds.join(' AND ')}${ord}`, params);
        children.push(...rows);
      }
    }
    const conv = children.map((r) => rowFromDb(rmeta, r));
    const childOut = conv.map((r) => project(rmeta, e.sel, r));
    if (e.sel.embeds.length) await attachEmbeds(db, ctx, rel.table, e.sel, filters, conv, childOut, path);
    const byKey = new Map();
    conv.forEach((r, i) => {
      const ks = JSON.stringify(rel.remoteCols.map((c) => children[i][c]));
      if (!byKey.has(ks)) byKey.set(ks, []);
      byKey.get(ks).push(childOut[i]);
    });
    const lim = filters.limits.embedded[path];
    rawRows.forEach((r, i) => {
      const ks = JSON.stringify(rel.localCols.map((c) => r[c]));
      let list = byKey.get(ks) || [];
      if (lim) list = list.slice(lim.offset || 0, (lim.offset || 0) + (lim.limit ?? list.length));
      let val = rel.kind === 'many' ? list : list[0] ?? null;
      if (e.spread && val && !Array.isArray(val)) {
        Object.assign(outRows[i], val);
      } else {
        outRows[i][e.alias] = val;
      }
    });
  }
}

export async function selectRows(db, ctx, table, { select = '*', filters, order, limit, offset, count = false, pkWhere = null }) {
  const meta = tableMeta(table);
  const pol = policyFor(ctx, table, 'select');
  if (pol.deny) return { rows: [], total: 0 };
  const sel = parseSelect(select);
  const params = [];
  const conds = [];
  if (pol.where) {
    conds.push(pol.where.sql.replaceAll('$T', 't'));
    params.push(...pol.where.params);
  }
  if (pkWhere) {
    conds.push(pkWhere.sql);
    params.push(...pkWhere.params);
  }
  const w = whereSql(meta, 't', filters.root, params);
  if (w) conds.push(w);
  conds.push(...innerEmbedConds(table, 't', sel, filters, params, ctx));
  const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
  let total = null;
  if (count) {
    const r = await db.first(`SELECT COUNT(*) AS n FROM ${q(table)} t${where}`, params);
    total = r ? r.n : 0;
  }
  let sql = `SELECT t.* FROM ${q(table)} t${where}${orderSql(meta, 't', order)}`;
  if (limit != null || offset != null) {
    sql += ` LIMIT ${limit != null ? Number(limit) : -1}`;
    if (offset) sql += ` OFFSET ${Number(offset)}`;
  }
  const raw = await db.all(sql, params);
  const conv = raw.map((r) => rowFromDb(meta, r));
  const out = conv.map((r) => project(meta, sel, r));
  if (sel.embeds.length) await attachEmbeds(db, ctx, table, sel, filters, conv, out);
  return { rows: out, total };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

function prepareRow(meta, table, obj) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ApiError(400, 'PGRST102', 'All object keys must match');
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const c = meta.cols[k];
    if (!c) {
      throw new ApiError(400, 'PGRST204', `Could not find the '${k}' column of '${table}' in the schema cache`);
    }
    if (v === undefined) continue;
    out[k] = toDb(c, v, k);
  }
  return out;
}

const softChecksByTable = {};
for (const ch of SOFT_CHECKS) (softChecksByTable[ch.table] ||= []).push(ch);

/** CHECKs do PostgreSQL que o SQLite não expressa (regex/jsonb_typeof). */
function softCheck(table, row) {
  for (const ch of softChecksByTable[table] || []) {
    const ok = evalSoftCheck(ch.expr, row);
    if (ok === false) throw new ApiError(400, '23514', `new row for relation "${table}" violates check constraint "${ch.name}"`);
  }
}

function evalSoftCheck(expr, row) {
  // Avalia as poucas formas existentes: "col IS NULL OR col ~ 're'",
  // "jsonb_typeof(col) = 'object'", "array_to_string(col, ',') ~ 're'",
  // "a >= 0 AND b >= 0 AND ...".
  const clauses = expr.split(/\s+AND\s+/i);
  for (const cl of clauses) {
    let m;
    const c = cl.trim();
    if ((m = c.match(/^(\w+) IS NULL OR (\w+) ~ '(.*)'$/s))) {
      const v = row[m[1]];
      if (v != null && !new RegExp(m[3]).test(String(v))) return false;
    } else if ((m = c.match(/^(\w+) ~ '(.*)'$/s))) {
      const v = row[m[1]];
      if (v != null && !new RegExp(m[2]).test(String(v))) return false;
    } else if ((m = c.match(/^jsonb_typeof\((\w+)\) = 'object'$/))) {
      let v = row[m[1]];
      if (typeof v === 'string') {
        try {
          v = JSON.parse(v);
        } catch {
          return false;
        }
      }
      if (v != null && (typeof v !== 'object' || Array.isArray(v))) return false;
    } else if ((m = c.match(/^array_to_string\((\w+), ','\) ~ '(.*)'$/s))) {
      let v = row[m[1]];
      if (typeof v === 'string') v = JSON.parse(v);
      if (v != null && !new RegExp(m[2]).test((v || []).join(','))) return false;
    } else if ((m = c.match(/^(\w+) >= 0$/))) {
      if (row[m[1]] != null && Number(row[m[1]]) < 0) return false;
    }
  }
  return true;
}

function pkCols(meta) {
  return meta.pk && meta.pk.length ? meta.pk : ['id'];
}

function pkWhereFor(meta, rows) {
  const pk = pkCols(meta);
  const params = [];
  if (!rows.length) return { sql: '0', params };
  if (pk.length === 1) {
    return {
      sql: `t.${q(pk[0])} IN (${rows.map((r) => {
        params.push(r[pk[0]]);
        return '?';
      }).join(',')})`,
      params,
    };
  }
  return {
    sql: '(' + rows.map((r) => '(' + pk.map((c) => {
      params.push(r[c]);
      return `t.${q(c)} = ?`;
    }).join(' AND ') + ')').join(' OR ') + ')',
    params,
  };
}

/**
 * Executa a escrita e, se alguma tabela de eventos/despesas mudou (mesmo por
 * regra automática), roda a sincronização de lançamentos bancários, como os
 * gatilhos auto_sync_* do original. Erros da sincronização são ignorados,
 * como no original (RAISE WARNING).
 */
export async function txTracked(db, statements) {
  const list = POST_SYNC_TABLES.map((t) => `'${t}'`).join(',');
  const probe = { sql: `SELECT tbl, version FROM _changes WHERE tbl IN (${list})` };
  const res = await db.tx([probe, ...statements, probe]);
  const before = new Map(res[0].map((r) => [r.tbl, r.version]));
  const after = res[res.length - 1];
  const changed = after.some((r) => before.get(r.tbl) !== r.version);
  if (changed) {
    try {
      await db.tx(syncBankTransactionsSql());
    } catch (e) {
      console.warn('Error in sync_bank_transactions:', e.message);
    }
  }
  return res.slice(1, -1);
}

export async function insertRows(db, ctx, table, body, { upsert = null, onConflict = null, select = null, returning = true }) {
  const meta = tableMeta(table);
  const items = Array.isArray(body) ? body : [body];
  if (!items.length) return [];
  const pol = policyFor(ctx, table, 'insert');
  if (pol.deny) throw new ApiError(403, '42501', `new row violates row-level security policy for table "${table}"`);
  const statements = [];
  for (const it of items) {
    const raw = beforeInsert(ctx, table, { ...it });
    checkWrite(ctx, table, 'insert', raw);
    const row = prepareRow(meta, table, raw);
    softCheck(table, row);
    const cols = Object.keys(row);
    const vals = cols.map((c) => row[c]);
    let sql;
    if (!cols.length) {
      sql = `INSERT INTO ${q(table)} DEFAULT VALUES`;
    } else {
      sql = `INSERT INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    }
    if (upsert) {
      const target = onConflict ? onConflict.split(',').map((s) => s.trim()) : pkCols(meta);
      if (upsert === 'ignore') {
        sql += ` ON CONFLICT (${target.map(q).join(', ')}) DO NOTHING`;
      } else {
        const upd = cols.filter((c) => !target.includes(c));
        sql += upd.length
          ? ` ON CONFLICT (${target.map(q).join(', ')}) DO UPDATE SET ${upd.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}`
          : ` ON CONFLICT (${target.map(q).join(', ')}) DO NOTHING`;
      }
    }
    sql += ' RETURNING *';
    statements.push({ sql, params: vals });
  }
  const results = await txTracked(db, statements);
  afterWrite(db, table);
  const rows = results.flat();
  if (!returning) return [];
  return reselect(db, ctx, table, meta, rows, select);
}

async function reselect(db, ctx, table, meta, rows, select) {
  if (!rows.length) return [];
  const sel = select || '*';
  const parsed = parseSelect(sel);
  const conv = rows.map((r) => rowFromDb(meta, r));
  if (!parsed.embeds.length) return conv.map((r) => project(meta, parsed, r));
  const out = [];
  for (let i = 0; i < conv.length; i += 40) {
    const { rows } = await selectRows(db, { ...ctx, service: true }, table, {
      select: sel,
      filters: { root: [], embedded: {}, order: { root: null, embedded: {} }, limits: { embedded: {} } },
      pkWhere: pkWhereFor(meta, conv.slice(i, i + 40)),
    });
    out.push(...rows);
  }
  return out;
}

export async function updateRows(db, ctx, table, body, filters, { select = null, returning = true }) {
  const meta = tableMeta(table);
  const pol = policyFor(ctx, table, 'update');
  if (pol.deny) return [];
  const raw = beforeUpdate(ctx, table, { ...(body || {}) });
  checkWrite(ctx, table, 'update', raw);
  const params = [];
  const conds = [];
  if (pol.where) {
    conds.push(pol.where.sql.replaceAll('$T', 't'));
    params.push(...pol.where.params);
  }
  const w = whereSql(meta, 't', filters.root, params);
  if (w) conds.push(w);
  const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';

  let statements;
  if (needsPerRowUpdate(table)) {
    // a alteração depende dos valores antigos de cada linha (ex.: contratos)
    const olds = (await db.all(`SELECT t.* FROM ${q(table)} t${where}`, params)).map((r) => rowFromDb(meta, r));
    statements = olds.map((old) => {
      const row = prepareRow(meta, table, perRowPatch(ctx, table, old, raw));
      softCheck(table, row);
      const cols = Object.keys(row);
      const pk = pkCols(meta);
      return {
        sql: `UPDATE ${q(table)} AS t SET ${cols.map((c) => `${q(c)} = ?`).join(', ')} WHERE ${pk.map((c) => `t.${q(c)} = ?`).join(' AND ')} RETURNING *`,
        params: [...cols.map((c) => row[c]), ...pk.map((c) => old[c])],
      };
    });
    if (!statements.length) return [];
  } else {
    const row = prepareRow(meta, table, raw);
    softCheck(table, row);
    const cols = Object.keys(row);
    if (!cols.length) return [];
    statements = [{ sql: `UPDATE ${q(table)} AS t SET ${cols.map((c) => `${q(c)} = ?`).join(', ')}${where} RETURNING *`, params: [...cols.map((c) => row[c]), ...params] }];
  }
  const rows = (await txTracked(db, statements)).flat();
  afterWrite(db, table);
  if (!returning) return [];
  return reselect(db, ctx, table, meta, rows, select);
}

export async function deleteRows(db, ctx, table, filters, { select = null, returning = true }) {
  const meta = tableMeta(table);
  const pol = policyFor(ctx, table, 'delete');
  if (pol.deny) return [];
  const params = [];
  const conds = [];
  if (pol.where) {
    conds.push(pol.where.sql.replaceAll('$T', 't'));
    params.push(...pol.where.params);
  }
  const w = whereSql(meta, 't', filters.root, params);
  if (w) conds.push(w);
  const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
  const sql = `DELETE FROM ${q(table)} AS t${where} RETURNING *`;
  const [rows] = await txTracked(db, [{ sql, params }]);
  afterWrite(db, table);
  if (!returning) return [];
  const sel = parseSelect(select || '*');
  return rows.map((r) => project(meta, sel, rowFromDb(meta, r)));
}

// ---------------------------------------------------------------------------
// Roteamento HTTP /rest/v1/<tabela>
// ---------------------------------------------------------------------------

function parsePrefer(h) {
  const out = {};
  for (const part of (h || '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k) out[k.trim()] = (v || '').trim();
  }
  return out;
}

function parseRange(h) {
  const m = (h || '').match(/(\d+)-(\d*)/);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] === '' ? null : Number(m[2]);
  return { offset: from, limit: to == null ? null : to - from + 1 };
}

export async function handleRest(request, db, ctx, table) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const method = request.method.toUpperCase();
  const prefer = parsePrefer(request.headers.get('Prefer'));
  const accept = request.headers.get('Accept') || '';
  const wantsObject = accept.includes('application/vnd.pgrst.object');
  const filters = parseFilters(params);
  const select = params.get('select');

  let rows;
  let total = null;
  let status = 200;
  const headers = {};

  if (method === 'GET' || method === 'HEAD') {
    let limit = params.has('limit') ? Number(params.get('limit')) : null;
    let offset = params.has('offset') ? Number(params.get('offset')) : null;
    const range = parseRange(request.headers.get('Range'));
    if (range) {
      offset = range.offset;
      if (range.limit != null) limit = limit != null ? Math.min(limit, range.limit) : range.limit;
    }
    const count = prefer.count === 'exact' || prefer.count === 'planned' || prefer.count === 'estimated';
    const res = await selectRows(db, ctx, table, {
      select: select || '*',
      filters,
      order: params.get('order'),
      limit,
      offset,
      count,
    });
    rows = res.rows;
    total = res.total;
    const start = offset || 0;
    headers['Content-Range'] = rows.length ? `${start}-${start + rows.length - 1}/${total ?? '*'}` : `*/${total ?? '*'}`;
    if (count && total != null && rows.length < total && (limit != null || offset)) status = 206;
    if (method === 'HEAD') return new Response(null, { status, headers });
  } else if (method === 'POST') {
    const body = await request.json().catch(() => {
      throw new ApiError(400, 'PGRST102', 'Empty or invalid json');
    });
    let upsert = null;
    if (prefer.resolution === 'merge-duplicates') upsert = 'merge';
    if (prefer.resolution === 'ignore-duplicates') upsert = 'ignore';
    const returning = prefer.return === 'representation';
    rows = await insertRows(db, ctx, table, body, { upsert, onConflict: params.get('on_conflict'), select, returning });
    status = 201;
    if (!returning) return new Response(null, { status, headers: { 'Content-Range': `*/*` } });
  } else if (method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const returning = prefer.return === 'representation';
    rows = await updateRows(db, ctx, table, body, filters, { select, returning });
    if (!returning) return new Response(null, { status: 204, headers: { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/*` } });
  } else if (method === 'PUT') {
    const body = await request.json();
    rows = await insertRows(db, ctx, table, body, { upsert: 'merge', select, returning: true });
  } else if (method === 'DELETE') {
    const returning = prefer.return === 'representation';
    rows = await deleteRows(db, ctx, table, filters, { select, returning });
    if (!returning) return new Response(null, { status: 204 });
  } else {
    throw new ApiError(405, 'PGRST117', `Unsupported HTTP method: ${method}`);
  }

  if (wantsObject) {
    if (rows.length !== 1) {
      throw new ApiError(
        406,
        'PGRST116',
        'JSON object requested, multiple (or no) rows returned',
        `The result contains ${rows.length} rows`,
      );
    }
    return json(rows[0], status, headers);
  }
  return json(rows, status, headers);
}
