import { describe, it, expect } from "vitest";
import {
  evaluateNFSeReadiness,
  canEmitStatus,
  isResend,
  normalizeEnvironment,
  isCertificateExpired,
  describeEmitError,
} from "@/lib/nfse";

const baseConfig = {
  is_configured: true,
  municipality_code: "2529",
  default_service_code: "1401",
  default_iss_rate: 5,
  environment: "homologacao",
  active_certificate_id: "cert-1",
};

const activeCert = { id: "cert-1", is_active: true, valid_until: "2099-01-01" };

describe("nfse readiness", () => {
  it("aprova configuração completa com certificado válido", () => {
    const r = evaluateNFSeReadiness(baseConfig, [activeCert]);
    expect(r.ready).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.environment).toBe("homologacao");
    expect(r.isProduction).toBe(false);
  });

  it("bloqueia quando não há configuração", () => {
    const r = evaluateNFSeReadiness(null, []);
    expect(r.ready).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("bloqueia certificado expirado", () => {
    const r = evaluateNFSeReadiness(baseConfig, [
      { id: "cert-1", is_active: true, valid_until: "2020-01-01" },
    ]);
    expect(r.certificateExpired).toBe(true);
    expect(r.ready).toBe(false);
  });

  it("bloqueia sem certificado ativo", () => {
    const r = evaluateNFSeReadiness(baseConfig, [
      { id: "cert-1", is_active: false, valid_until: "2099-01-01" },
    ]);
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toContain("certificado");
  });

  it("identifica ambiente de produção", () => {
    const r = evaluateNFSeReadiness({ ...baseConfig, environment: "producao" }, [activeCert]);
    expect(r.isProduction).toBe(true);
  });

  it("bloqueia ambiente indefinido", () => {
    const r = evaluateNFSeReadiness({ ...baseConfig, environment: "" }, [activeCert]);
    expect(r.ready).toBe(false);
  });
});

describe("status de emissão", () => {
  it("permite apenas rps_generated e error", () => {
    expect(canEmitStatus("rps_generated")).toBe(true);
    expect(canEmitStatus("error")).toBe(true);
    expect(canEmitStatus("authorized")).toBe(false);
    expect(canEmitStatus("processing")).toBe(false);
    expect(canEmitStatus("cancelled")).toBe(false);
  });

  it("marca reenvio somente para error", () => {
    expect(isResend("error")).toBe(true);
    expect(isResend("rps_generated")).toBe(false);
  });
});

describe("helpers", () => {
  it("normaliza ambiente", () => {
    expect(normalizeEnvironment("PRODUCAO")).toBe("producao");
    expect(normalizeEnvironment("homologacao")).toBe("homologacao");
    expect(normalizeEnvironment(null)).toBe("desconhecido");
  });

  it("detecta expiração", () => {
    expect(isCertificateExpired("2020-01-01", new Date("2026-01-01"))).toBe(true);
    expect(isCertificateExpired("2030-01-01", new Date("2026-01-01"))).toBe(false);
    expect(isCertificateExpired(null)).toBe(false);
  });

  it("descreve erros retornados pela função", () => {
    expect(describeEmitError({ error: "Falha", instructions: "Configure o secret" })).toBe(
      "Falha — Configure o secret"
    );
    expect(describeEmitError({ errors: ["E1: a", "E2: b"] })).toBe("E1: a; E2: b");
    expect(describeEmitError(null, "fallback")).toBe("fallback");
  });
});
