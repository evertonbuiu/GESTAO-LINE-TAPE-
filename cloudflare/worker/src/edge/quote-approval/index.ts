// Copiado de supabase/functions/quote-approval/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { createClient } from "../../compat/supabase.js"
import { corsHeaders } from "../../compat/cors.js"

// Aprovação pública de orçamento por token expirável.
// Usa service_role internamente, mas SEMPRE resolve o orçamento a partir do
// token recebido — nunca aceita um quote_id vindo do cliente.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

async function loadApproval(token: string) {
  const { data, error } = await admin
    .from('quote_approvals')
    .select('id, quote_id, status, expires_at, accepted_name, accepted_at, accepted_snapshot')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

// Somente campos que o cliente pode ver — nada de custos internos.
const publicQuoteFields =
  'id, quote_number, quote_date, client_name, client_email, client_phone, event_name, event_location, event_date, products, subtotal, discount_percentage, discount_amount, travel_expense, accommodation_expense, total_amount, valid_until, notes'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const token =
      req.method === 'GET'
        ? (url.searchParams.get('token') ?? '')
        : ((await req.clone().json().catch(() => ({}))) as { token?: string }).token ?? ''

    if (!TOKEN_RE.test(token)) return json({ error: 'Link inválido.' }, 400)

    const approval = await loadApproval(token)
    if (!approval) return json({ error: 'Link inválido ou removido.' }, 404)

    const expired = new Date(approval.expires_at).getTime() < Date.now()
    if (expired && approval.status === 'pendente') {
      await admin.from('quote_approvals').update({ status: 'expirado' }).eq('id', approval.id)
      approval.status = 'expirado'
    }

    const { data: quote, error: quoteError } = await admin
      .from('external_quotes')
      .select(publicQuoteFields)
      .eq('id', approval.quote_id)
      .maybeSingle()
    if (quoteError) throw quoteError
    if (!quote) return json({ error: 'Orçamento não encontrado.' }, 404)

    if (req.method === 'GET') {
      return json({
        status: approval.status,
        expires_at: approval.expires_at,
        accepted_name: approval.accepted_name,
        accepted_at: approval.accepted_at,
        quote: approval.status === 'aceito' ? (approval.accepted_snapshot ?? quote) : quote,
      })
    }

    if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      name?: string
      reason?: string
    }

    // Leitura também via POST (compatível com supabase.functions.invoke)
    if (body.action === 'get') {
      return json({
        status: approval.status,
        expires_at: approval.expires_at,
        accepted_name: approval.accepted_name,
        accepted_at: approval.accepted_at,
        quote: approval.status === 'aceito' ? (approval.accepted_snapshot ?? quote) : quote,
      })
    }

    const action = body.action === 'reject' ? 'reject' : 'accept'

    if (approval.status !== 'pendente') {
      return json({ error: `Este orçamento já está como "${approval.status}".` }, 409)
    }
    if (expired) return json({ error: 'Este link expirou.' }, 410)


    if (action === 'reject') {
      const reason = (body.reason ?? '').toString().slice(0, 500)
      await admin
        .from('quote_approvals')
        .update({ status: 'recusado', rejection_reason: reason, accepted_ip: clientIp(req) })
        .eq('id', approval.id)
      return json({ status: 'recusado' })
    }

    const name = (body.name ?? '').toString().trim()
    if (name.length < 3 || name.length > 120) {
      return json({ error: 'Informe seu nome completo (3 a 120 caracteres).' }, 400)
    }

    const { error: updateError } = await admin
      .from('quote_approvals')
      .update({
        status: 'aceito',
        accepted_name: name,
        accepted_at: new Date().toISOString(),
        accepted_ip: clientIp(req),
        accepted_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
        accepted_snapshot: quote,
      })
      .eq('id', approval.id)
      .eq('status', 'pendente')
    if (updateError) throw updateError

    await admin.from('external_quotes').update({ status: 'aprovado' }).eq('id', approval.quote_id)

    return json({ status: 'aceito', accepted_name: name })
  } catch (e) {
    console.error('quote-approval error', e)
    return json({ error: 'Erro ao processar a solicitação.' }, 500)
  }
})
