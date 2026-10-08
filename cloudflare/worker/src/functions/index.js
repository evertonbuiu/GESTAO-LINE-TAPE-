// Funções de servidor (antes: Supabase Edge Functions em supabase/functions).
//
// O código original de cada função foi copiado para src/edge/<nome>/ (ver
// cloudflare/tools/port_functions.py) e roda aqui dentro do Worker com um
// ambiente compatível (Deno.env, serve, createClient).
import '../compat/deno.js';
import { setEnv, takeHandler } from '../compat/deno.js';
import { setRuntime } from '../compat/supabase.js';
import { corsHeaders } from '../util.js';

const EDGE = {
  'c6-auth-test': () => import('../edge/c6-auth-test/index.ts'),
  'c6-receipt': () => import('../edge/c6-receipt/index.ts'),
  'c6-statement-sync': () => import('../edge/c6-statement-sync/index.ts'),
  'c6-statement-test': () => import('../edge/c6-statement-test/index.ts'),
  'create-employee': () => import('../edge/create-employee/index.ts'),
  'create-user': () => import('../edge/create-user/index.ts'),
  'emit-nfse': () => import('../edge/emit-nfse/index.ts'),
  'fiscal-document': () => import('../edge/fiscal-document/index.ts'),
  'import-budget': () => import('../edge/import-budget/index.ts'),
  'manage-employee': () => import('../edge/manage-employee/index.ts'),
  'nfse-nacional-homologacao': () => import('../edge/nfse-nacional-homologacao/index.ts'),
  'pluggy-connect-token': () => import('../edge/pluggy-connect-token/index.ts'),
  'pluggy-sync': () => import('../edge/pluggy-sync/index.ts'),
  'quote-approval': () => import('../edge/quote-approval/index.ts'),
  'serve-pdf': () => import('../edge/serve-pdf/index.ts'),
  'whatsapp-webhook': () => import('../edge/whatsapp-webhook/index.ts'),
};

const HANDLERS = {};

async function handlerFor(name) {
  if (HANDLERS[name]) return HANDLERS[name];
  const load = EDGE[name];
  if (!load) return null;
  await load();
  const h = takeHandler();
  if (!h) throw new Error(`A função ${name} não registrou um handler (serve/Deno.serve)`);
  HANDLERS[name] = h;
  return h;
}

export async function handleFunction(name, request, env, db) {
  setEnv(env);
  setRuntime({ env, db });
  const h = await handlerFor(name);
  if (!h) {
    return new Response(JSON.stringify({ error: `Função não encontrada: ${name}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const res = await h(request);
  // As funções originais fixavam a origem do site antigo no CORS; aqui vale a
  // origem configurada em ALLOWED_ORIGINS.
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(env, request))) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Tarefas agendadas (wrangler.toml -> triggers.crons). */
export async function runScheduled(event, env, db) {
  const jobs = (env.SCHEDULED_FUNCTIONS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of jobs) {
    try {
      const req = new Request(`http://local/functions/v1/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.SERVICE_ROLE_KEY || ''}` },
        body: JSON.stringify({ scheduled: true, cron: event.cron }),
      });
      const res = await handleFunction(name, req, env, db);
      console.log(`Tarefa agendada ${name}: ${res.status}`);
    } catch (e) {
      console.error(`Tarefa agendada ${name} falhou:`, e && e.message);
    }
  }
}
