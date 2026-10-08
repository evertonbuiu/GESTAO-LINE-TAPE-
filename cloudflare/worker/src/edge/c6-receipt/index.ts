// Copiado de supabase/functions/c6-receipt/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// (import de tipos do Supabase Edge Runtime removido)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const secret = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405, headers: corsHeaders });

  let client: Deno.HttpClient | undefined;
  try {
    const { receipt_path: receiptPath } = await req.json();
    if (typeof receiptPath !== "string" || !receiptPath.startsWith("/") ||
      !/^\/(transfer\/pix\/receipt|payment\/branches\/.+\/receipt)\//.test(receiptPath)) {
      return new Response("Comprovante inválido", { status: 400, headers: corsHeaders });
    }

    const environment = (Deno.env.get("C6_API_ENV") || "sandbox").toLowerCase();
    const baseUrl = environment === "production"
      ? "https://baas-api.c6bank.info/v1"
      : "https://baas-api-sandbox.c6bank.info/v1";
    client = Deno.createHttpClient({ cert: secret("C6_MTLS_CERT"), key: secret("C6_MTLS_KEY") });

    const authResponse = await fetch(`${baseUrl}/auth/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: secret("C6_CLIENT_ID"),
        client_secret: secret("C6_CLIENT_SECRET"),
        grant_type: "client_credentials",
      }),
      client,
      signal: AbortSignal.timeout(20_000),
    });
    const auth = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || typeof auth.access_token !== "string") {
      return new Response("Autenticação recusada pelo C6", { status: 502, headers: corsHeaders });
    }

    const receiptResponse = await fetch(`${baseUrl}${receiptPath}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      client,
      signal: AbortSignal.timeout(20_000),
    });
    if (!receiptResponse.ok) return new Response("Comprovante indisponível", { status: 502, headers: corsHeaders });

    return new Response(receiptResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": receiptResponse.headers.get("content-type") || "application/pdf",
        "Content-Disposition": "inline; filename=comprovante-c6.pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("C6 receipt failed", error instanceof Error ? error.message : String(error));
    return new Response("Falha ao carregar comprovante", { status: 500, headers: corsHeaders });
  } finally {
    client?.close();
  }
});
