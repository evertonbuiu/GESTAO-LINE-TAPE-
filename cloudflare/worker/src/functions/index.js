// Funções de servidor (antes: Supabase Edge Functions em supabase/functions).
// Cada função foi portada para rodar dentro do Worker.
import { ApiError, errorResponse, json } from '../util.js';
import { buildContext } from '../index.js';

const REGISTRY = {};

export function register(name, handler) {
  REGISTRY[name] = handler;
}

/**
 * Cliente "administrador" usado pelas funções no lugar do supabase-js com
 * service role: acessa o banco sem as permissões por linha.
 */
export async function handleFunction(name, request, env, db, ctxExec) {
  await loadAll();
  const fn = REGISTRY[name];
  if (!fn) return json({ error: `Função não encontrada: ${name}` }, 404);
  try {
    const ctx = await buildContext(request, env, db).catch((e) => {
      if (e instanceof ApiError && e.status === 401) return { uid: null, roles: new Set(), permissions: {} };
      throw e;
    });
    return await fn({ request, env, db, ctx, ctxExec });
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status >= 500 ? 500 : 400);
    return errorResponse(e);
  }
}

let loaded = false;
async function loadAll() {
  if (loaded) return;
  loaded = true;
  const mods = await Promise.all([
    import('./users.js'),
    import('./quote-approval.js'),
    import('./serve-pdf.js'),
    import('./import-budget.js'),
    import('./fiscal-document.js'),
    import('./nfse.js'),
    import('./c6.js'),
    import('./pluggy.js'),
    import('./whatsapp.js'),
  ]);
  for (const m of mods) if (typeof m.default === 'function') m.default(register);
}

/** Tarefas agendadas configuradas em wrangler.toml (triggers.crons). */
export async function runScheduled(event, env, db) {
  await loadAll();
  const jobs = Object.entries(REGISTRY).filter(([, fn]) => typeof fn.scheduled === 'function');
  for (const [name, fn] of jobs) {
    try {
      await fn.scheduled({ event, env, db });
    } catch (e) {
      console.error(`Tarefa agendada ${name} falhou:`, e && e.message);
    }
  }
}
