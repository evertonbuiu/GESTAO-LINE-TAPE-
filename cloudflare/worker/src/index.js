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

// Página simples para criar o primeiro administrador pelo navegador.
const SETUP_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuração inicial</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1220;color:#e8e8f0;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#171a2b;padding:28px;border-radius:12px;width:min(360px,90vw);display:grid;gap:12px}
h1{font-size:18px;margin:0 0 4px}p{margin:0;font-size:13px;color:#a8abc0}
input,button{padding:10px;border-radius:8px;border:1px solid #2c3050;background:#0f1220;color:inherit;font-size:14px}
button{background:#6d5dfc;border:0;cursor:pointer;font-weight:600}#msg{font-size:13px;min-height:18px}</style></head>
<body><form id="f"><h1>GESTÃO LINE TAPE</h1><p>Criar o primeiro administrador. Só funciona enquanto não existe nenhum usuário.</p>
<input name="token" placeholder="Token de configuração (se tiver cadastrado)">
<input name="name" placeholder="Seu nome" required>
<input name="username" placeholder="Usuário" value="admin" required>
<input name="password" type="password" placeholder="Senha (mín. 6)" minlength="6" required>
<button>Criar administrador</button><div id="msg"></div></form>
<script>document.getElementById('f').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
const m=document.getElementById('msg');m.textContent='Enviando...';
const r=await fetch('/setup/first-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
const j=await r.json().catch(()=>({}));m.textContent=r.ok?j.message:(j.message||'Erro');}</script></body></html>`;

/**
 * Cria o primeiro administrador. Só funciona enquanto não existe nenhum
 * usuário e exige o segredo SETUP_TOKEN (cadastrado no Cloudflare).
 * Corpo: { "token": "...", "username": "admin", "password": "...", "name": "..." }
 */
async function firstAdmin(request, env, db) {
  const body = (await request.json().catch(() => null)) || {};
  // Com SETUP_TOKEN cadastrado, ele é exigido. Sem ele, a criação só é
  // possível enquanto não existe nenhum usuário (fecha sozinha em seguida).
  if (env.SETUP_TOKEN && body.token !== env.SETUP_TOKEN) {
    throw new ApiError(403, '42501', 'Token de configuração inválido');
  }
  const any = await db.first('SELECT COUNT(*) AS n FROM auth_users');
  if (any && any.n > 0) throw new ApiError(409, '23505', 'Já existe usuário cadastrado; use a tela de usuários.');
  const username = String(body.username || 'admin').trim().toLowerCase();
  if (!body.password || String(body.password).length < 6) {
    throw new ApiError(400, '22023', 'Informe uma senha com pelo menos 6 caracteres');
  }
  const { adminCreateUser } = await import('./auth.js');
  const user = await adminCreateUser(db, {
    email: `${username}@linetape.local`,
    password: String(body.password),
    user_metadata: { username, name: body.name || username },
  });
  await db.tx([
    {
      sql: "INSERT INTO user_credentials (id, username, password_hash, name, is_active) VALUES (?, ?, 'managed-by-auth', ?, 1)",
      params: [user.id, username, body.name || username],
    },
    { sql: "INSERT INTO user_roles (user_id, role) VALUES (?, 'admin')", params: [user.id] },
  ]);
  return json({ ok: true, username, message: 'Administrador criado. Entre no sistema com esse usuário.' });
}

async function route(request, env, ctxExec) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const baseDb = new Db(env.DB);

  if (path === '' || path === '/' || path === '/health') {
    return json({ ok: true, service: 'gestao-line-tape' });
  }

  let m;
  if (path === '/setup/first-admin' && request.method === 'POST') {
    return firstAdmin(request, env, baseDb);
  }
  if (path === '/setup' && request.method === 'GET') {
    return new Response(SETUP_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
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

/**
 * Chave que assina os logins: usa o segredo JWT_SECRET se existir; senão,
 * gera uma chave aleatória na primeira vez e guarda no banco (_settings).
 */
let cachedSecret = null;
async function ensureSecrets(env) {
  if (env.JWT_SECRET) return;
  if (!cachedSecret) {
    const row = await env.DB.prepare("SELECT v FROM _settings WHERE k = 'jwt_secret'").first().catch(() => null);
    if (row && row.v) {
      cachedSecret = row.v;
    } else {
      const a = new Uint8Array(48);
      crypto.getRandomValues(a);
      const fresh = [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
      await env.DB.prepare("INSERT INTO _settings (k, v) VALUES ('jwt_secret', ?) ON CONFLICT (k) DO NOTHING").bind(fresh).run();
      const again = await env.DB.prepare("SELECT v FROM _settings WHERE k = 'jwt_secret'").first();
      cachedSecret = again.v;
    }
  }
  env.JWT_SECRET = cachedSecret;
}

export default {
  async fetch(request, env, ctxExec) {
    const cors = corsHeaders(env, request);
    try {
      await ensureSecrets(env);
    } catch (e) {
      return errorResponse(e);
    }
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
