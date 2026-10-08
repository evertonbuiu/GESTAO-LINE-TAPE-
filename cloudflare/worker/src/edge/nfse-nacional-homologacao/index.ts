// Copiado de supabase/functions/nfse-nacional-homologacao/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// Edge Function SEPARADA — homologação NFS-e Padrão Nacional (DPS).
// Não altera nem chama o adaptador ABRASF 2.04 de produção (emit-nfse).
// Ações suportadas: 'preflight' (somente leitura) e 'preview_dps' (prévia XML).
// TRANSMISSÃO NÃO IMPLEMENTADA: qualquer ação de envio retorna 403.
import { serve } from "../../compat/deno.js";
import { createClient } from "../../compat/supabase.js";
import { buildCorsHeaders, isDevEnvironment, isOriginAllowed } from "./cors.ts";
import {
  NATIONAL_HOMOLOGATION_URL,
  NATIONAL_HOMOLOGATION_WSDL,
  NATIONAL_MANUAL_URL,
  NATIONAL_MANUAL_VERSION,
  NATIONAL_PROVIDER_DEFAULTS,
  WS_TIMEOUT_MS,
  buildDpsPreviewXml,
  containsForbiddenAliquota,
  diagnoseNationalHomologation,
  evaluateTransmissionGate,
  validateDpsInput,
  validateNationalProvider,
} from "./national.ts";

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const origin = req.headers.get("origin");
  const isDev = isDevEnvironment(Deno.env.get("ENVIRONMENT") ?? Deno.env.get("DENO_ENV"));
  const corsHeaders = buildCorsHeaders(origin, isDev);

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin, isDev)) {
      return new Response("origin not allowed", { status: 403, headers: corsHeaders });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (roleError || !["admin", "financeiro"].includes(roleData?.role)) {
      return json({ error: "Forbidden" }, 403, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "preflight";

    const { data: config } = await supabase
      .from("nfse_config")
      .select("*, nfse_certificates(*)")
      .limit(1)
      .maybeSingle();

    const gate = evaluateTransmissionGate(config);

    // Qualquer tentativa de transmitir é bloqueada nesta fase.
    if (action !== "preflight" && action !== "preview_dps") {
      return json(
        {
          error: "Transmissão no padrão nacional está bloqueada.",
          transmission_allowed: false,
          reasons: gate.reasons,
        },
        403,
        corsHeaders
      );
    }

    if (action === "preflight") {
      const certPassword = Deno.env.get("NFSE_CERT_PASSWORD");
      const activeCert = config?.nfse_certificates ?? null;
      const providerErrors = validateNationalProvider({
        provider_cnpj: config?.provider_cnpj,
        provider_im: config?.provider_im,
        municipality_code: config?.municipality_code,
      });

      // Somente leitura: GET ?WSDL, sem chamar nenhum método fiscal.
      const diagnostics = await diagnoseNationalHomologation(WS_TIMEOUT_MS);

      const checks = {
        adapter: "nfse-nacional-homologacao",
        environment: "homologacao_nacional",
        manual_version: NATIONAL_MANUAL_VERSION,
        manual_url: NATIONAL_MANUAL_URL,
        endpoint: NATIONAL_HOMOLOGATION_URL,
        wsdl_url: NATIONAL_HOMOLOGATION_WSDL,
        timeout_ms: WS_TIMEOUT_MS,
        tls: diagnostics.tls,
        http: diagnostics.http,
        http_status: diagnostics.http_status,
        contract_valid: diagnostics.contract_valid,
        wsdl_operations: diagnostics.operations,
        wsdl_detail: diagnostics.detail,
        certificate_linked: Boolean(activeCert?.storage_path),
        certificate_active: Boolean(activeCert?.is_active),
        certificate_password_secret_configured: Boolean(certPassword),
        provider_valid: providerErrors.length === 0,
        provider_errors: providerErrors,
        registration_status: config?.national_registration_status ?? "nao_solicitado",
        homologation_enabled: Boolean(config?.national_homologation_enabled),
        transmission_allowed: false,
        transmission_block_reasons: gate.reasons,
      };

      const ready =
        diagnostics.reachable &&
        providerErrors.length === 0 &&
        Boolean(activeCert?.storage_path) &&
        Boolean(certPassword);

      return json(
        {
          ready,
          transmitted: false,
          notice: "Ambiente de homologação — não vale como nota fiscal.",
          checks,
          instructions: ready
            ? null
            : [
                !diagnostics.reachable
                  ? `WebService de homologação não respondeu um WSDL válido (${diagnostics.detail ?? "sem detalhe"}).`
                  : null,
                providerErrors.join(" ") || null,
                !activeCert?.storage_path ? "Nenhum certificado A1 vinculado." : null,
                !certPassword ? "Secret NFSE_CERT_PASSWORD não configurado." : null,
              ]
                .filter(Boolean)
                .join(" "),
        },
        200,
        corsHeaders
      );
    }

    // action === 'preview_dps' — gera XML localmente, nada é enviado.
    const input = {
      dps_number: String(body?.dps_number ?? "1"),
      series: String(body?.series ?? NATIONAL_PROVIDER_DEFAULTS.series),
      issue_date: String(body?.issue_date ?? new Date().toISOString()),
      competence_date: String(body?.competence_date ?? new Date().toISOString()),
      taker_document: body?.taker_document ?? null,
      taker_name: body?.taker_name ?? null,
      taker_email: body?.taker_email ?? null,
      service_description: String(body?.service_description ?? ""),
      service_value: Number(body?.service_value ?? 0),
      national_service_code: body?.national_service_code ?? NATIONAL_PROVIDER_DEFAULTS.national_service_code,
      cnae_code: config?.default_cnae_code ?? NATIONAL_PROVIDER_DEFAULTS.cnae_code,
      municipality_code: config?.municipality_code ?? NATIONAL_PROVIDER_DEFAULTS.municipality_code,
      provider_cnpj: config?.provider_cnpj ?? NATIONAL_PROVIDER_DEFAULTS.provider_cnpj,
      provider_im: config?.provider_im ?? NATIONAL_PROVIDER_DEFAULTS.provider_im,
    };

    const errors = validateDpsInput(input);
    if (errors.length) {
      return json({ error: "Dados inválidos para a prévia da DPS", errors, transmitted: false }, 400, corsHeaders);
    }

    const xml = buildDpsPreviewXml(input);
    if (containsForbiddenAliquota(xml)) {
      return json(
        { error: "XML gerado contém alíquota, proibida no padrão nacional.", transmitted: false },
        500,
        corsHeaders
      );
    }

    return json(
      {
        transmitted: false,
        signed: false,
        notice: "Prévia de homologação — não vale como nota fiscal e não foi transmitida.",
        manual_version: NATIONAL_MANUAL_VERSION,
        xml,
      },
      200,
      corsHeaders
    );
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Erro inesperado", transmitted: false }, 500, corsHeaders);
  }
});
