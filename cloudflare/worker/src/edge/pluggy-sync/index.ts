// Copiado de supabase/functions/pluggy-sync/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { createClient } from "../../compat/supabase.js";

const primaryOrigin = 'https://luz-locacao-controle-estoque.lovable.app';
const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    origin === primaryOrigin ||
    origin === 'https://linetape-iluminacao.lovable.app' ||
    origin.endsWith('.lovable.app') ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : primaryOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};

async function pluggyKey() {
  const response = await fetch('https://api.pluggy.ai/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: Deno.env.get('PLUGGY_CLIENT_ID'), clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET') }) });
  if (!response.ok) throw new Error(`AutenticaÃ§Ã£o Pluggy falhou (${response.status})`);
  return (await response.json()).apiKey as string;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('authorization');
  if (!authorization) return json({ error: 'NÃ£o autenticado' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: anon } });
  if (!userResponse.ok) return json({ error: 'SessÃ£o invÃ¡lida' }, 401);
  const user = await userResponse.json();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const roleResponse = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${user.id}&role=in.(admin,financeiro)&select=role`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  const roles = roleResponse.ok ? await roleResponse.json() : [];
  if (!roles.length) return json({ error: 'Acesso restrito ao financeiro' }, 403);

  try {
    const { itemId } = await req.json();
    if (!itemId || typeof itemId !== 'string') return json({ error: 'ConexÃ£o bancÃ¡ria invÃ¡lida' }, 400);
    const apiKey = await pluggyKey();
    const headers = { 'X-API-KEY': apiKey };
    const accountsResponse = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, { headers });
    if (!accountsResponse.ok) throw new Error(`Consulta de contas falhou (${accountsResponse.status})`);
    const accounts = (await accountsResponse.json()).results ?? [];
    const admin = createClient(url, serviceKey);
    let imported = 0;

    for (const account of accounts) {
      const accountType = account.type === 'SAVINGS' ? 'savings' : 'checking';
      const { data: saved, error } = await admin.from('bank_accounts').upsert({ pluggy_account_id: account.id, pluggy_item_id: itemId, name: account.name || account.marketingName || 'Conta Open Finance', account_type: accountType, balance: Number(account.balance ?? 0) }, { onConflict: 'pluggy_account_id' }).select('id').single();
      if (error) throw error;
      const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const txResponse = await fetch(`https://api.pluggy.ai/transactions?accountId=${encodeURIComponent(account.id)}&from=${from}&pageSize=500`, { headers });
      if (!txResponse.ok) throw new Error(`Consulta de transaÃ§Ãµes falhou (${txResponse.status})`);
      const transactions = (await txResponse.json()).results ?? [];
      if (transactions.length) {
        const rows = transactions.map((tx: any) => ({ bank_account_id: saved.id, pluggy_transaction_id: tx.id, description: tx.description || tx.descriptionRaw || 'MovimentaÃ§Ã£o bancÃ¡ria', amount: Math.abs(Number(tx.amount || 0)), transaction_type: Number(tx.amount || 0) >= 0 ? 'income' : 'expense', category: tx.category || 'Open Finance', reference_type: 'manual', transaction_date: String(tx.date || new Date().toISOString()).slice(0, 10) }));
        const { error: txError } = await admin.from('bank_transactions').upsert(rows, { onConflict: 'pluggy_transaction_id', ignoreDuplicates: true });
        if (txError) throw txError;
        imported += rows.length;
      }
    }
    return json({ accounts: accounts.length, transactions: imported });
  } catch (error) {
    console.error('pluggy-sync:', error);
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado' }, 502);
  }
});

