// Testes da Edge Function emit-nfse (não realizam nenhuma emissão real:
// apenas validam contratos de autorização, entrada e regras de status).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const FN_URL = `${SUPABASE_URL}/functions/v1/emit-nfse`;

const EMITTABLE = ["rps_generated", "error"];
const canEmitStatus = (s: string) => EMITTABLE.includes(s);

Deno.test("regra de status: nunca retransmite authorized/processing", () => {
  assert(canEmitStatus("rps_generated"));
  assert(canEmitStatus("error"));
  assertEquals(canEmitStatus("authorized"), false);
  assertEquals(canEmitStatus("processing"), false);
  assertEquals(canEmitStatus("cancelled"), false);
});

Deno.test("rejeita requisição sem Authorization", async () => {
  if (!SUPABASE_URL) return;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "preflight" }),
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `status inesperado: ${res.status}`);
});

Deno.test("rejeita token anônimo (sem papel admin/financeiro)", async () => {
  if (!SUPABASE_URL || !ANON_KEY) return;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ action: "preflight" }),
  });
  await res.text();
  assert(res.status === 401 || res.status === 403, `status inesperado: ${res.status}`);
});
