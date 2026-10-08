// Login próprio, no mesmo formato do Supabase Auth (o supabase-js do app
// continua funcionando sem mudanças): /auth/v1/token, /user, /logout.
//
// O app usa "usuário" + senha; internamente o usuário vira um e-mail
// sintético <usuario>@linetape.local, como no sistema original.
import { hashPassword, randomToken, signJwt, verifyJwt, verifyPassword } from './crypto.js';
import { ApiError, json, nowIso, readJson, uuid } from './util.js';

const ACCESS_TTL = 60 * 60; // 1 hora
const REFRESH_TTL_DAYS = 30;

function authError(status, errorCode, msg) {
  return json(
    { code: status, error_code: errorCode, msg, error: errorCode, error_description: msg },
    status,
  );
}

export function userObject(row) {
  let meta = {};
  try {
    meta = JSON.parse(row.raw_user_meta_data || '{}');
  } catch {
    meta = {};
  }
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: row.created_at,
    phone: '',
    confirmed_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: meta,
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
  };
}

async function issueSession(env, db, userRow) {
  const now = Math.floor(Date.now() / 1000);
  const user = userObject(userRow);
  const sessionId = uuid();
  const access = await signJwt(
    {
      aud: 'authenticated',
      exp: now + ACCESS_TTL,
      iat: now,
      iss: 'linetape-worker',
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      session_id: sessionId,
      is_anonymous: false,
    },
    env.JWT_SECRET,
  );
  const refresh = randomToken(32);
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000).toISOString();
  await db.d1
    .prepare('INSERT INTO auth_refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(refresh, user.id, expires)
    .run();
  return {
    access_token: access,
    token_type: 'bearer',
    expires_in: ACCESS_TTL,
    expires_at: now + ACCESS_TTL,
    refresh_token: refresh,
    user,
  };
}

/** Lê o token da requisição. Retorna o payload do JWT ou null. */
export async function sessionFromRequest(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  if (!token) return null;
  if (env.SERVICE_ROLE_KEY && token === env.SERVICE_ROLE_KEY) return { service: true };
  if (env.ANON_KEY && token === env.ANON_KEY) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  return payload;
}

export async function handleAuth(request, env, db, path) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (path === 'token' && method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const body = (await readJson(request)) || {};
    if (grant === 'password') {
      const email = String(body.email || '').trim().toLowerCase();
      const row = await db.first('SELECT * FROM auth_users WHERE email = ?', [email]);
      if (!row || row.banned || !(await verifyPassword(String(body.password || ''), row.password_hash))) {
        return authError(400, 'invalid_credentials', 'Invalid login credentials');
      }
      // usuário desativado no cadastro de funcionários
      const cred = await db.first('SELECT is_active FROM user_credentials WHERE id = ?', [row.id]);
      if (cred && cred.is_active === 0) {
        return authError(400, 'user_banned', 'User is banned');
      }
      const ts = nowIso();
      await db.d1.prepare('UPDATE auth_users SET last_sign_in_at = ? WHERE id = ?').bind(ts, row.id).run();
      await db.d1.prepare('UPDATE user_credentials SET last_login = ? WHERE id = ?').bind(ts, row.id).run().catch(() => {});
      row.last_sign_in_at = ts;
      return json(await issueSession(env, db, row));
    }
    if (grant === 'refresh_token') {
      const tok = String(body.refresh_token || '');
      const rt = await db.first('SELECT * FROM auth_refresh_tokens WHERE token = ?', [tok]);
      if (!rt || rt.revoked || rt.expires_at < new Date().toISOString()) {
        return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      }
      const row = await db.first('SELECT * FROM auth_users WHERE id = ?', [rt.user_id]);
      if (!row || row.banned) return authError(400, 'user_banned', 'User is banned');
      // token de atualização é de uso único (rotação), como no Supabase
      await db.d1.prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE token = ?').bind(tok).run();
      return json(await issueSession(env, db, row));
    }
    return authError(400, 'unsupported_grant_type', 'Unsupported grant type');
  }

  if (path === 'user') {
    const s = await sessionFromRequest(request, env).catch(() => null);
    if (!s || !s.sub) return authError(401, 'no_authorization', 'This endpoint requires a valid Bearer token');
    const row = await db.first('SELECT * FROM auth_users WHERE id = ?', [s.sub]);
    if (!row) return authError(404, 'user_not_found', 'User from sub claim in JWT does not exist');
    if (method === 'GET') return json(userObject(row));
    if (method === 'PUT') {
      const body = (await readJson(request)) || {};
      if (body.password) {
        if (String(body.password).length < 6) {
          return authError(422, 'weak_password', 'Password should be at least 6 characters.');
        }
        const hash = await hashPassword(String(body.password));
        await db.d1.prepare('UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(hash, nowIso(), row.id).run();
      }
      if (body.data && typeof body.data === 'object') {
        let meta = {};
        try {
          meta = JSON.parse(row.raw_user_meta_data || '{}');
        } catch {
          meta = {};
        }
        Object.assign(meta, body.data);
        await db.d1
          .prepare('UPDATE auth_users SET raw_user_meta_data = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(meta), nowIso(), row.id)
          .run();
      }
      const fresh = await db.first('SELECT * FROM auth_users WHERE id = ?', [row.id]);
      return json(userObject(fresh));
    }
  }

  if (path === 'logout' && method === 'POST') {
    const s = await sessionFromRequest(request, env).catch(() => null);
    if (s && s.sub) {
      const scope = url.searchParams.get('scope') || 'global';
      if (scope !== 'local') {
        await db.d1.prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE user_id = ?').bind(s.sub).run();
      }
    }
    return new Response(null, { status: 204 });
  }

  if (path === 'settings') {
    return json({ external: { email: true }, disable_signup: true, mailer_autoconfirm: true });
  }

  if (path === 'signup') {
    return authError(422, 'signup_disabled', 'Signups not allowed for this instance');
  }

  return authError(404, 'not_found', 'Not found');
}

// ---------------------------------------------------------------------------
// Administração de usuários (usada pelas funções de servidor)
// ---------------------------------------------------------------------------

export async function adminCreateUser(db, { email, password, user_metadata = {}, id = null }) {
  const em = String(email).trim().toLowerCase();
  const exists = await db.first('SELECT id FROM auth_users WHERE email = ?', [em]);
  if (exists) throw new ApiError(422, 'email_exists', 'A user with this email address has already been registered');
  const uid = id || uuid();
  const hash = await hashPassword(String(password));
  await db.d1
    .prepare('INSERT INTO auth_users (id, email, password_hash, raw_user_meta_data) VALUES (?, ?, ?, ?)')
    .bind(uid, em, hash, JSON.stringify(user_metadata || {}))
    .run();
  return userObject(await db.first('SELECT * FROM auth_users WHERE id = ?', [uid]));
}

export async function adminUpdateUser(db, id, { password, email, user_metadata, ban_duration } = {}) {
  const row = await db.first('SELECT * FROM auth_users WHERE id = ?', [id]);
  if (!row) throw new ApiError(404, 'user_not_found', 'User not found');
  if (password) {
    await db.d1.prepare('UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(await hashPassword(String(password)), nowIso(), id).run();
  }
  if (email) {
    await db.d1.prepare('UPDATE auth_users SET email = ?, updated_at = ? WHERE id = ?').bind(String(email).trim().toLowerCase(), nowIso(), id).run();
  }
  if (user_metadata) {
    let meta = {};
    try {
      meta = JSON.parse(row.raw_user_meta_data || '{}');
    } catch {
      meta = {};
    }
    await db.d1.prepare('UPDATE auth_users SET raw_user_meta_data = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify({ ...meta, ...user_metadata }), nowIso(), id).run();
  }
  if (ban_duration !== undefined) {
    const banned = ban_duration && ban_duration !== 'none' ? 1 : 0;
    await db.d1.prepare('UPDATE auth_users SET banned = ? WHERE id = ?').bind(banned, id).run();
    if (banned) await db.d1.prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE user_id = ?').bind(id).run();
  }
  return userObject(await db.first('SELECT * FROM auth_users WHERE id = ?', [id]));
}

export async function adminDeleteUser(db, id) {
  await db.d1.prepare('DELETE FROM auth_users WHERE id = ?').bind(id).run();
}
