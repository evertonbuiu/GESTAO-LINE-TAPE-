import { describe, it, expect } from "vitest";
import {
  describeEmitError,
  friendlyInvokeError,
  describePreflight,
  canEmitStatus,
} from "@/lib/nfse";

describe("erros de emissão NFS-e", () => {
  it("preserva mensagem detalhada de senha inválida vinda da Edge Function", () => {
    const msg = describeEmitError({
      error: "Senha do certificado digital (NFSE_CERT_PASSWORD) inválida para este arquivo .pfx",
      error_code: "CERT_PASSWORD_INVALID",
      instructions: "Atualize o secret NFSE_CERT_PASSWORD com a senha correta do certificado .pfx",
    });
    expect(msg).toContain("NFSE_CERT_PASSWORD");
    expect(msg).toContain("Atualize o secret");
  });

  it("nunca expõe a senha do certificado na mensagem", () => {
    const msg = describeEmitError({ error: "Senha do certificado inválida", instructions: "Atualize o secret" });
    expect(msg).not.toMatch(/password=|senha:\s*\S+/i);
  });

  it("orienta reconciliação por RPS em timeout sem resposta HTTP", () => {
    const msg = describeEmitError({
      error: "Sem resposta do WebService da Prefeitura (timeout 30000ms).",
      error_code: "WS_NO_RESPONSE",
      reconciliation_required: true,
    });
    expect(msg).toContain("RPS");
  });

  it("substitui o erro genérico do supabase-js por orientação acionável", () => {
    const msg = friendlyInvokeError("Failed to send a request to the Edge Function");
    expect(msg).toContain("Validar certificado e conexão");
    expect(msg).not.toBe("Failed to send a request to the Edge Function");
  });

  it("usa a tradução amigável também como fallback do describeEmitError", () => {
    const msg = describeEmitError(null, "Failed to send a request to the Edge Function");
    expect(msg).toContain("Nenhuma nota foi transmitida");
  });
});

describe("preflight", () => {
  it("descreve sucesso", () => {
    expect(describePreflight({ ready: true })).toContain("acessível");
  });

  it("descreve pendência com instrução", () => {
    const msg = describePreflight({
      ready: false,
      error: "Senha do certificado digital inválida",
      instructions: "Atualize o secret NFSE_CERT_PASSWORD",
    });
    expect(msg).toContain("Senha do certificado digital inválida");
    expect(msg).toContain("NFSE_CERT_PASSWORD");
  });

  it("lida com ausência de resposta", () => {
    expect(describePreflight(null)).toContain("Não foi possível validar");
  });
});

describe("idempotência e rollback de status", () => {
  const CLAIMABLE = ["rps_generated", "error"];
  const STUCK = ["processing", "pending_transmission", "awaiting_send"];

  it("apenas rps_generated/error podem ser reivindicados para transmissão", () => {
    for (const s of CLAIMABLE) expect(canEmitStatus(s)).toBe(true);
    for (const s of [...STUCK, "authorized", "cancelled"]) expect(canEmitStatus(s)).toBe(false);
  });

  it("rollback move estados transitórios para error (nunca para authorized)", () => {
    const rollback = (status: string) => (STUCK.includes(status) ? "error" : status);
    expect(STUCK.map(rollback)).toEqual(["error", "error", "error"]);
    expect(rollback("authorized")).toBe("authorized");
  });

  it("nota autorizada nunca é retransmitida após timeout", () => {
    expect(canEmitStatus("authorized")).toBe(false);
  });
});
