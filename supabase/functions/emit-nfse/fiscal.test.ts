import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateProviderFiscalDefaults,
  PROVIDER_IM,
  DEFAULT_SERVICE_CODE,
  RPS_SERIES,
} from "./fiscal.ts";

Deno.test("padrões fiscais confirmados na NFS-e autorizada", () => {
  assertEquals(PROVIDER_IM, "5412455");
  assertEquals(DEFAULT_SERVICE_CODE, "12.12");
  assertEquals(RPS_SERIES, "1");
});

Deno.test("preflight aprova IM 5412455, série 1 e código 12.12", () => {
  const errors = validateProviderFiscalDefaults({
    provider_im: "5412455",
    rps_series: "1",
    default_service_code: "12.12",
  });
  assertEquals(errors.length, 0);
});

Deno.test("preflight bloqueia IM, série ou código divergentes", () => {
  const errors = validateProviderFiscalDefaults({
    provider_im: "0000000",
    rps_series: "RPS",
    default_service_code: "99.99",
  });
  assertEquals(errors.length, 3);
  assert(errors.join(" ").includes("5412455"));
  assert(errors.join(" ").includes("12.12"));
});

Deno.test("IM aceita máscara mas exige o mesmo número", () => {
  assertEquals(
    validateProviderFiscalDefaults({
      provider_im: "5.412.455",
      rps_series: "1",
      default_service_code: "12.12",
    }).length,
    0
  );
});
