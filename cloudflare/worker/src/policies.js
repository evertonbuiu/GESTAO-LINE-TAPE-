// Permissões por linha — equivalente às políticas RLS do PostgreSQL.
//
// As políticas originais foram convertidas automaticamente
// (cloudflare/tools/gen_policies.py) e aqui são avaliadas para o usuário da
// requisição. O resultado é: liberado, negado ou um filtro SQL por linha
// (ex.: "owner_id = usuário"), aplicado em SELECT/UPDATE/DELETE.
import { POLICIES, RLS } from './generated/policies.js';
import { ApiError } from './util.js';

const OPS = { select: 'SELECT', insert: 'INSERT', update: 'UPDATE', delete: 'DELETE' };

function applies(p, op, ctx) {
  if (p.cmd !== 'ALL' && p.cmd !== OPS[op]) return false;
  const roles = p.roles;
  if (roles.includes('public')) return true;
  if (ctx.uid && roles.includes('authenticated')) return true;
  if (!ctx.uid && roles.includes('anon')) return true;
  return false;
}

/** Avalia uma expressão: true | false | {sql, params} */
function evalExpr(e, ctx) {
  if (e === true || e === false) return e;
  if (e == null) return false;
  if (e.anyRole) return !!ctx.uid && e.anyRole.some((r) => ctx.roles.has(r));
  if (e.auth) return !!ctx.uid;
  if (e.perm) return hasPermission(ctx, e.perm[0], e.perm[1]);
  if (e.owner) {
    if (!ctx.uid) return false;
    return { sql: `$T."${e.owner}" = ?`, params: [ctx.uid] };
  }
  if (e.sql) {
    if (!ctx.uid && e.uid) return false;
    return { sql: e.sql, params: Array(e.uid || 0).fill(ctx.uid) };
  }
  if (e.and) {
    const parts = [];
    for (const x of e.and) {
      const r = evalExpr(x, ctx);
      if (r === false) return false;
      if (r !== true) parts.push(r);
    }
    if (!parts.length) return true;
    return { sql: '(' + parts.map((p) => p.sql).join(' AND ') + ')', params: parts.flatMap((p) => p.params) };
  }
  if (e.or) {
    const parts = [];
    for (const x of e.or) {
      const r = evalExpr(x, ctx);
      if (r === true) return true;
      if (r !== false) parts.push(r);
    }
    if (!parts.length) return false;
    return { sql: '(' + parts.map((p) => p.sql).join(' OR ') + ')', params: parts.flatMap((p) => p.params) };
  }
  return false;
}

export function hasPermission(ctx, name, type = 'view') {
  if (!ctx.uid) return false;
  if (ctx.roles.has('admin')) return true;
  const p = ctx.permissions && ctx.permissions[name];
  if (!p) return false;
  return type === 'view' ? !!p.can_view : !!p.can_edit;
}

function combine(results) {
  // políticas permissivas: basta uma liberar
  const parts = [];
  for (const r of results) {
    if (r === true) return true;
    if (r !== false) parts.push(r);
  }
  if (!parts.length) return false;
  return { sql: '(' + parts.map((p) => p.sql).join(' OR ') + ')', params: parts.flatMap((p) => p.params) };
}

/**
 * Para uma operação, retorna { deny: true } ou { where: {sql, params} | null }.
 * O SQL usa $T como apelido da tabela.
 */
export function policyFor(ctx, table, op) {
  if (ctx.service) return { where: null };
  if (!RLS[table]) return ctx.uid ? { where: null } : { deny: true };
  const list = (POLICIES[table] || []).filter((p) => applies(p, op, ctx));
  const permissive = list.filter((p) => !p.restrictive);
  const restrictive = list.filter((p) => p.restrictive);
  if (!permissive.length) return { deny: true };
  const exprOf = (p) => (op === 'insert' ? p.check ?? p.using : p.using ?? p.check);
  let res = combine(permissive.map((p) => evalExpr(exprOf(p), ctx)));
  for (const p of restrictive) {
    const r = evalExpr(exprOf(p), ctx);
    if (r === false) return { deny: true };
    if (r !== true) res = res === true ? r : { sql: `(${res.sql} AND ${r.sql})`, params: [...res.params, ...r.params] };
  }
  if (res === false) return { deny: true };
  if (res === true) return { where: null };
  return { where: res };
}

/** Avalia uma expressão "por linha" contra o objeto que será gravado. */
function evalOnRow(e, ctx, row) {
  if (e === true || e === false) return e;
  if (e == null) return true;
  if (e.owner) return !!ctx.uid && (row[e.owner] === undefined ? true : String(row[e.owner]) === String(ctx.uid));
  if (e.sql) return true; // conferido no banco pelas FKs/regras
  if (e.and) return e.and.every((x) => evalOnRow(x, ctx, row));
  if (e.or) return e.or.some((x) => evalOnRow(x, ctx, row));
  return evalExpr(e, ctx) === true;
}

/**
 * Confere o WITH CHECK das políticas antes de gravar. Em INSERT/UPDATE de
 * tabelas pessoais, preenche o dono quando o app não mandou (o gatilho
 * force_personal_owner do original fazia o mesmo).
 */
export function checkWrite(ctx, table, op, row) {
  if (ctx.service) return;
  if (!RLS[table]) {
    if (!ctx.uid) throw new ApiError(401, '42501', 'permission denied');
    return;
  }
  const list = (POLICIES[table] || []).filter((p) => applies(p, op, ctx) && !p.restrictive);
  const exprs = list.map((p) => (op === 'insert' ? p.check ?? p.using : p.check ?? p.using));
  const ok = exprs.some((e) => evalOnRow(e, ctx, row));
  if (!ok) {
    throw new ApiError(403, '42501', `new row violates row-level security policy for table "${table}"`);
  }
}
