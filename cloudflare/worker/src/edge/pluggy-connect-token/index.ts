// Copiado de supabase/functions/pluggy-connect-token/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
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

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authorization = req.headers.get('authorization');
  if (!authorization) return new Response(JSON.stringify({ error: 'NÃ£o autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization, apikey: anonKey } });
  if (!userResponse.ok) return new Response(JSON.stringify({ error: 'SessÃ£o invÃ¡lida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const user = await userResponse.json();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const roleResponse = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${user.id}&role=in.(admin,financeiro)&select=role`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  const roles = roleResponse.ok ? await roleResponse.json() : [];
  if (!roles.length) return new Response(JSON.stringify({ error: 'Acesso restrito ao financeiro' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const clientId = Deno.env.get('PLUGGY_CLIENT_ID');
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return new Response(JSON.stringify({ error: 'Pluggy nÃ£o configurada' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!authResponse.ok) throw new Error(`Falha ao autenticar na Pluggy (${authResponse.status})`);
    const { apiKey } = await authResponse.json();

    const tokenResponse = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ clientUserId: user.id }),
    });
    if (!tokenResponse.ok) throw new Error(`Falha ao criar Connect Token (${tokenResponse.status})`);
    const token = await tokenResponse.json();
    return new Response(JSON.stringify({ accessToken: token.accessToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('pluggy-connect-token:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro inesperado' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

