// Testes de CORS da função emit-nfse (nenhuma nota é emitida).
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCorsHeaders, isOriginAllowed, isDevEnvironment } from "./cors.ts";

const PROD = "https://linetape-iluminacao.lovable.app";
const PREVIEW = "https://preview--linetape-iluminacao.lovable.app";
const ID_PREVIEW = "https://id-preview--b20ed6db-6569-4397-bdc1-d90583ef9a95.lovable.app";
const EVIL = "https://linetape-iluminacao.lovable.app.evil.com";

Deno.test("permite origem de produção", () => {
  assert(isOriginAllowed(PROD));
  assertEquals(buildCorsHeaders(PROD)["Access-Control-Allow-Origin"], PROD);
});

Deno.test("permite previews oficiais do projeto", () => {
  assert(isOriginAllowed(PREVIEW));
  assert(isOriginAllowed(ID_PREVIEW));
  assertEquals(buildCorsHeaders(PREVIEW)["Access-Control-Allow-Origin"], PREVIEW);
});

Deno.test("bloqueia origem maliciosa e não reflete origem arbitrária", () => {
  assertEquals(isOriginAllowed(EVIL), false);
  const h = buildCorsHeaders(EVIL);
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
  assertEquals(h["Vary"], "Origin");
});

Deno.test("localhost apenas em desenvolvimento", () => {
  assertEquals(isOriginAllowed("http://localhost:8080"), false);
  assert(isOriginAllowed("http://localhost:8080", true));
  assert(isDevEnvironment("development"));
  assertEquals(isDevEnvironment("production"), false);
});

Deno.test("headers de preflight (OPTIONS) completos", () => {
  const h = buildCorsHeaders(PROD);
  assertEquals(h["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assertEquals(h["Vary"], "Origin");
  for (const header of ["authorization", "apikey", "content-type", "x-client-info"]) {
    assert(h["Access-Control-Allow-Headers"].includes(header), `faltando ${header}`);
  }
});
