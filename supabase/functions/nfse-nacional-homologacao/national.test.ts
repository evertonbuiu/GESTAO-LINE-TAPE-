// Testes do adaptador nacional de homologação. Nenhum documento é transmitido.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  LEGACY_ABRASF_PRODUCTION_URL,
  NATIONAL_HOMOLOGATION_URL,
  NATIONAL_HOMOLOGATION_WSDL,
  NATIONAL_PROVIDER_DEFAULTS,
  buildDpsId,
  buildDpsPreviewXml,
  containsForbiddenAliquota,
  diagnoseNationalHomologation,
  evaluateTransmissionGate,
  parseNationalWsdl,
  validateDpsInput,
  validateNationalProvider,
} from "./national.ts";

const baseInput = {
  dps_number: "12",
  series: "1",
  issue_date: "2026-03-13T10:00:00Z",
  competence_date: "2026-03-13",
  taker_document: "12345678000199",
  taker_name: "Cliente Teste",
  service_description: "Execução de música com sonorização e iluminação",
  service_value: 1500,
};

Deno.test("endpoint oficial de homologação e isolamento da produção", () => {
  assertEquals(
    NATIONAL_HOMOLOGATION_URL,
    "https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx"
  );
  assertEquals(NATIONAL_HOMOLOGATION_WSDL, `${NATIONAL_HOMOLOGATION_URL}?WSDL`);
  assert(String(NATIONAL_HOMOLOGATION_URL) !== String(LEGACY_ABRASF_PRODUCTION_URL));
  assert(!NATIONAL_HOMOLOGATION_URL.includes("abrasf204"));
});

Deno.test("parse de WSDL aceita contrato válido e rejeita HTML", () => {
  const wsdl = `<wsdl:definitions><operation soapAction="http://x/GerarNfse"/></wsdl:definitions>`;
  const parsed = parseNationalWsdl(wsdl);
  assert(parsed.valid);
  assertEquals(parsed.operations, ["GerarNfse"]);
  assertEquals(parseNationalWsdl("<html>erro</html>").valid, false);
});

Deno.test("diagnóstico é somente leitura (GET) e respeita timeout", async () => {
  let method = "";
  const fakeFetch = ((url: string | URL | Request, init?: RequestInit) => {
    method = init?.method ?? "GET";
    return Promise.resolve(
      new Response(`<wsdl:definitions><operation soapAction="http://x/RecepcionarDPS"/></wsdl:definitions>`, {
        status: 200,
      })
    );
  }) as unknown as typeof fetch;

  const result = await diagnoseNationalHomologation(30000, fakeFetch);
  assertEquals(method, "GET");
  assert(result.reachable);
  assertEquals(result.tls, true);
  assertEquals(result.http_status, 200);
});

Deno.test("bloqueio de transmissão é sempre verdadeiro nesta fase", () => {
  const gate = evaluateTransmissionGate({
    national_homologation_enabled: true,
    national_transmission_enabled: true,
    national_registration_status: "aprovado",
  });
  assertEquals(gate.allowed, false);
  assert(gate.reasons.length > 0);

  const blocked = evaluateTransmissionGate(null);
  assertEquals(blocked.allowed, false);
  assert(blocked.reasons.some((r) => r.includes("não aprovado")));
});

Deno.test("validação de prestador usa os dados confirmados", () => {
  assertEquals(
    validateNationalProvider({
      provider_cnpj: "42.089.948/0001-05",
      provider_im: "5412455",
      municipality_code: "5208707",
    }),
    []
  );
  assertEquals(
    validateNationalProvider({ provider_cnpj: "1", provider_im: "2", municipality_code: "3" }).length,
    3
  );
});

Deno.test("Id da DPS segue o layout do manual v1.01", () => {
  const id = buildDpsId({
    municipality_code: "5208707",
    provider_cnpj: "42089948000105",
    series: "1",
    dps_number: "12",
  });
  assertEquals(id.length, 45);
  assertStringIncludes(id, "DPS52087072");
  assert(id.endsWith("000000000000012"));
});

Deno.test("prévia XML DPS contém campos obrigatórios e nenhuma alíquota", () => {
  const xml = buildDpsPreviewXml(baseInput);
  assertStringIncludes(xml, 'xmlns="http://www.sped.fazenda.gov.br/nfse"');
  assertStringIncludes(xml, "<tpAmb>2</tpAmb>");
  assertStringIncludes(xml, "<CNPJ>42089948000105</CNPJ>");
  assertStringIncludes(xml, "<IM>5412455</IM>");
  assertStringIncludes(xml, `<cTribNac>${NATIONAL_PROVIDER_DEFAULTS.national_service_code}</cTribNac>`);
  assertStringIncludes(xml, "<vServ>1500.00</vServ>");
  assertStringIncludes(xml, "<cLocPrestacao>5208707</cLocPrestacao>");
  assertEquals(containsForbiddenAliquota(xml), false);
});

Deno.test("prévia escapa caracteres e trata tomador CPF", () => {
  const xml = buildDpsPreviewXml({ ...baseInput, taker_document: "12345678901", service_description: "Som & luz <A>" });
  assertStringIncludes(xml, "<CPF>12345678901</CPF>");
  assertStringIncludes(xml, "Som &amp; luz &lt;A&gt;");
});

Deno.test("validação da DPS rejeita valores e documentos inválidos", () => {
  const errors = validateDpsInput({ ...baseInput, service_value: 0, taker_document: "123", service_description: "a" });
  assert(errors.length >= 3);
  assertEquals(validateDpsInput(baseInput), []);
});
