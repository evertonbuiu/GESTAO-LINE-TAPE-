// Testes do contrato SGISS/ISSNet (ABRASF 2.04) — nenhuma nota é transmitida.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GOIANIA_MUNICIPALITY_CODE,
  LEGACY_ENDPOINTS,
  REQUIRED_RPS_SERIES,
  WS_TIMEOUT_MS,
  buildSoapEnvelope,
  diagnoseWebService,
  getEndpoint,
  parseWsdlOperations,
  soapActionFor,
  validateMunicipalityAndSeries,
} from "./webservice.ts";

const OFFICIAL = "https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx";

Deno.test("usa o endpoint oficial de produção e nunca o antigo", () => {
  const ep = getEndpoint("producao");
  assertEquals(ep.url, OFFICIAL);
  assertEquals(ep.wsdlUrl, `${OFFICIAL}?WSDL`);
  for (const legacy of LEGACY_ENDPOINTS) {
    assert(ep.url !== legacy, "endpoint antigo não pode ser usado");
  }
});

Deno.test("homologação não é suportada pelo SGISS de Goiânia", () => {
  const ep = getEndpoint("homologacao");
  assertEquals(ep.available, false);
  assert(ep.note && ep.note.length > 0);
});

Deno.test("SOAPAction e envelope seguem o contrato ABRASF 2.04 do ISSNet", () => {
  assertEquals(soapActionFor("GerarNfse"), "http://nfse.abrasf.org.br/GerarNfse");
  const env = buildSoapEnvelope("GerarNfse", '<?xml version="1.0"?><GerarNfseEnvio/>');
  assertStringIncludes(env, 'xmlns:ws="http://nfse.abrasf.org.br"');
  assertStringIncludes(env, "<ws:GerarNfse>");
  assertStringIncludes(env, "<nfseCabecMsg>");
  assertStringIncludes(env, "<nfseDadosMsg>");
  assertStringIncludes(env, 'versao="2.04"');
  assert(!env.includes("<?xml version=\"1.0\"?><GerarNfseEnvio/>".slice(0, 20) + "<?xml"));
});

Deno.test("valida município 5208707 e série 1", () => {
  assertEquals(validateMunicipalityAndSeries(GOIANIA_MUNICIPALITY_CODE, REQUIRED_RPS_SERIES).length, 0);
  const errs = validateMunicipalityAndSeries("2529", "RPS");
  assertEquals(errs.length, 2);
  assertStringIncludes(errs.join(" "), "5208707");
  assertStringIncludes(errs.join(" "), "série 1");
});

Deno.test("parseWsdlOperations reconhece o WSDL ABRASF", () => {
  const wsdl = `<wsdl:definitions xmlns:ws="http://nfse.abrasf.org.br">
    <soap:operation soapAction="http://nfse.abrasf.org.br/GerarNfse"/>
    <soap:operation soapAction="http://nfse.abrasf.org.br/ConsultarNfsePorRps"/>
  </wsdl:definitions>`;
  const r = parseWsdlOperations(wsdl);
  assertEquals(r.valid, true);
  assert(r.operations.includes("GerarNfse"));
  assertEquals(parseWsdlOperations("<html>erro</html>").valid, false);
});

Deno.test("diagnóstico separa DNS/TLS/HTTP/WSDL usando GET ?WSDL", async () => {
  let method = "";
  let calledUrl = "";
  const fakeFetch = ((url: string, init: RequestInit) => {
    calledUrl = String(url);
    method = String(init.method);
    return Promise.resolve(
      new Response('<wsdl:definitions xmlns:ws="http://nfse.abrasf.org.br"><soap:operation soapAction="http://nfse.abrasf.org.br/GerarNfse"/></wsdl:definitions>', { status: 200 })
    );
  }) as unknown as typeof fetch;

  const d = await diagnoseWebService("producao", 30000, fakeFetch);
  assertEquals(method, "GET");
  assertEquals(calledUrl, `${OFFICIAL}?WSDL`);
  assertEquals(d.reachable, true);
  assertEquals(d.dns, true);
  assertEquals(d.tls, true);
  assertEquals(d.http, true);
  assertEquals(d.wsdl, true);
  assert(d.wsdl_operations.includes("GerarNfse"));
});

Deno.test("timeout de 30s é o padrão e é reportado no diagnóstico", async () => {
  assertEquals(WS_TIMEOUT_MS, 30000);
  const hangingFetch = ((_u: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    })) as unknown as typeof fetch;

  const d = await diagnoseWebService("producao", 50, hangingFetch);
  assertEquals(d.reachable, false);
  assertEquals(d.http, false);
  assertStringIncludes(d.detail ?? "", "timeout");
});

Deno.test("HTTP 404/500 no WSDL bloqueia emissão (não é considerado alcançável)", async () => {
  const notFound = (() => Promise.resolve(new Response("not found", { status: 404 }))) as unknown as typeof fetch;
  const d = await diagnoseWebService("producao", 5000, notFound);
  assertEquals(d.reachable, false);
  assertEquals(d.wsdl, false);
  assertEquals(d.http_status, 404);
});
