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

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const validDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let client: Deno.HttpClient | undefined;
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const startDate = validDate(body.start_date) ? String(body.start_date) : isoDate(sevenDaysAgo);
    const endDate = validDate(body.end_date) ? String(body.end_date) : isoDate(today);
    const days = Math.floor(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
    );

    if (!Number.isFinite(days) || days < 0 || days > 30) {
      return json({ error: "O intervalo deve ter entre 0 e 30 dias" }, 400);
    }

    const environment = (Deno.env.get("C6_API_ENV") || "sandbox").toLowerCase();
    const baseUrl = environment === "production"
      ? "https://baas-api.c6bank.info/v1"
      : "https://baas-api-sandbox.c6bank.info/v1";

    client = Deno.createHttpClient({
      cert: secret("C6_MTLS_CERT"),
      key: secret("C6_MTLS_KEY"),
    });

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
      return json({ ok: false, error: "Autenticação recusada pelo C6" }, 502);
    }

    const statementUrl = new URL(`${baseUrl}/statement/`);
    statementUrl.searchParams.set("start_date", startDate);
    statementUrl.searchParams.set("end_date", endDate);

    const response = await fetch(statementUrl, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      client,
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("C6 statement rejected", { status: response.status, environment });
      return json({ ok: false, error: "Consulta de extrato recusada pelo C6" }, 502);
    }

    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    return json({
      ok: true,
      environment,
      start_date: startDate,
      end_date: endDate,
      entries_count: entries.length,
      data_received: true,
      note: "Valores e descrições foram omitidos deste teste seguro.",
    });
  } catch (error) {
    console.error("C6 statement test failed", error instanceof Error ? error.message : "unknown");
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha inesperada ao consultar o C6",
    }, 500);
  } finally {
    client?.close();
  }
});
