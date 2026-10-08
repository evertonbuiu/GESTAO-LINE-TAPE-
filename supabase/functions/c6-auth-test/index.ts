const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const secret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Segredo ${name} não configurado`);
  return value.replace(/\\n/g, "\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let client: Deno.HttpClient | undefined;
  try {
    const environment = (Deno.env.get("C6_API_ENV") || "sandbox").toLowerCase();
    const baseUrl = environment === "production"
      ? "https://baas-api.c6bank.info/v1"
      : "https://baas-api-sandbox.c6bank.info/v1";

    client = Deno.createHttpClient({
      cert: secret("C6_MTLS_CERT"),
      key: secret("C6_MTLS_KEY"),
    });

    const response = await fetch(`${baseUrl}/auth/`, {
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

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("C6 auth rejected", { status: response.status, environment });
      return json({ ok: false, status: response.status, error: "Autenticação recusada pelo C6" }, 502);
    }

    const rawScopes = payload.scope ?? payload.scopes ?? "";
    const scopes = Array.isArray(rawScopes)
      ? rawScopes
      : String(rawScopes).split(/[ ,]+/).filter(Boolean);

    return json({
      ok: true,
      environment,
      authenticated: Boolean(payload.access_token),
      expires_in: payload.expires_in ?? null,
      token_type: payload.token_type ?? "Bearer",
      scopes,
      statement_access: scopes.includes("statement.read"),
    });
  } catch (error) {
    console.error("C6 auth test failed", error instanceof Error ? error.message : "unknown");
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha inesperada ao autenticar no C6",
    }, 500);
  } finally {
    client?.close();
  }
});
