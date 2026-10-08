import { supabase } from "@/integrations/supabase/client";

const SENSITIVE_KEY = /(pass|senha|token|secret|key|authorization|apikey|jwt|credential)/i;

/** Remove qualquer dado sensível antes de enviar diagnóstico ao banco. */
export const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return "[profundidade máxima]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
};

export interface ErrorLogPayload {
  message: string;
  stack?: string | null;
  route?: string;
  context?: Record<string, unknown>;
}

export const buildDiagnostics = (payload: ErrorLogPayload) => ({
  message: payload.message,
  stack: payload.stack ?? null,
  route: payload.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
  context: sanitize(payload.context ?? {}),
  user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  timestamp: new Date().toISOString(),
});

/** Grava o erro em app_error_logs (silencioso em caso de falha). */
export const logAppError = async (payload: ErrorLogPayload) => {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return; // RLS só permite inserir registros próprios
    const diag = buildDiagnostics(payload);
    await supabase.from("app_error_logs").insert({
      user_id: userId,
      message: diag.message,
      stack: diag.stack,
      route: diag.route,
      context: diag.context as never,
      user_agent: diag.user_agent,
    });
  } catch {
    // nunca quebrar a aplicação por causa do log
  }
};
