// Worker principal da GESTÃO LINE TAPE no Cloudflare.
//
// Responde nos mesmos caminhos do Supabase, para que o app (supabase-js)
// funcione sem mudanças:
//   /auth/v1/*        login, sessão, troca de senha
//   /rest/v1/<tabela> dados (D1)
//   /rest/v1/rpc/<fn> funções do banco
//   /storage/v1/*     arquivos (R2)
//   /functions/v1/*   funções de servidor (NFS-e, C6, Pluggy, WhatsApp...)
//   /realtime/v1/changes  atualização automática das telas
import { handleAuth, sessionFromRequest } from './auth.js';
import { Db } from './db.js';
import { handleRest } from './rest.js';
import { handleRpc } from './rpc.js';
import { handleStorage } from './storage.js';
import { handleFunction } from './functions/index.js';
import { handleChanges } from './realtime.js';
import { ApiError, corsHeaders, errorResponse, json } from './util.js';

/** Monta o contexto do usuário: id, papéis e permissões. */
export async function buildContext(request, env, db) {
  const s = await sessionFromRequest(request, env);
  if (!s) return { uid: null, roles: new Set(), permissions: {} };
  if (s.service) return { uid: null, roles: new Set(), permissions: {}, service: true };
  const roles = await db.all('SELECT role FROM user_roles WHERE user_id = ?', [s.sub]);
  const roleSet = new Set(roles.map((r) => r.role));
  const permissions = {};
  if (roleSet.size && !roleSet.has('admin')) {
    const rows = await db.all(
      `SELECT p.name, MAX(rp.can_view) AS can_view, MAX(rp.can_edit) AS can_edit
         FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role IN (${[...roleSet].map(() => '?').join(',')})
        GROUP BY p.name`,
      [...roleSet],
    );
    for (const r of rows) permissions[r.name] = r;
  }
  return { uid: s.sub, email: s.email, role: [...roleSet][0] || null, roles: roleSet, permissions };
}

async function route(request, env, ctxExec) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const baseDb = new Db(env.DB);

  if (path === '' || path === '/' || path === '/health') {
    return json({ ok: true, service: 'gestao-line-tape' });
  }

  let m;
  if ((m = path.match(/^\/auth\/v1\/(.+)$/))) {
    return handleAuth(request, env, baseDb, m[1]);
  }

  // Funções de servidor tratam a própria autenticação (algumas são públicas,
  // como o webhook do WhatsApp e a aprovação de orçamento pelo cliente).
  if ((m = path.match(/^\/functions\/v1\/([\w-]+)(\/.*)?$/))) {
    return handleFunction(m[1], request, env, baseDb, ctxExec);
  }

  const ctx = await buildContext(request, env, baseDb);
  const db = baseDb.withCtx({ uid: ctx.uid, role: ctx.role, email: ctx.email, service: ctx.service });

  if (path === '/realtime/v1/changes') {
    if (!ctx.uid && !ctx.service) throw new ApiError(401, '42501', 'not authenticated');
    return handleChanges(request, db);
  }

  if ((m = path.match(/^\/rest\/v1\/rpc\/(\w+)$/))) {
    return handleRpc(request, env, db, ctx, m[1]);
  }
  if ((m = path.match(/^\/rest\/v1\/(\w+)$/))) {
    return handleRest(request, db, ctx, m[1]);
  }
  if ((m = path.match(/^\/storage\/v1\/(.+)$/))) {
    return handleStorage(request, env, db, ctx, m[1]);
  }
  throw new ApiError(404, 'PGRST000', `Rota não encontrada: ${path}`);
}

export default {
  async fetch(request, env, ctxExec) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(request, env, ctxExec);
    } catch (e) {
      res = errorResponse(e);
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) if (!headers.has(k)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },

  // Tarefas agendadas (sincronização bancária etc.) — ver wrangler.toml
  async scheduled(event, env, ctxExec) {
    const { runScheduled } = await import('./functions/index.js');
    ctxExec.waitUntil(runScheduled(event, env, new Db(env.DB)));
  },
};
