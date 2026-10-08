import { describe, it, expect } from "vitest";
import {
  NATIONAL_HOMOLOGATION_URL,
  NATIONAL_MANUAL_VERSION,
  NATIONAL_REGISTRATION_LABELS,
  canTransmitNational,
  isIsolatedFromProduction,
  nationalBlockReasons,
} from "@/lib/nfseNational";

describe("homologação NFS-e Nacional (DPS)", () => {
  it("usa o endpoint oficial de homologação e fica isolado da produção ABRASF", () => {
    expect(NATIONAL_HOMOLOGATION_URL).toBe(
      "https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx"
    );
    expect(isIsolatedFromProduction(NATIONAL_HOMOLOGATION_URL)).toBe(true);
    expect(
      isIsolatedFromProduction("https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx")
    ).toBe(false);
    expect(NATIONAL_MANUAL_VERSION).toBe("1.01");
  });

  it("nunca permite transmissão, mesmo com cadastro aprovado", () => {
    expect(
      canTransmitNational({
        national_homologation_enabled: true,
        national_transmission_enabled: true,
        national_registration_status: "aprovado",
      })
    ).toBe(false);
    expect(canTransmitNational(null)).toBe(false);
  });

  it("explica os motivos do bloqueio", () => {
    const reasons = nationalBlockReasons(null);
    expect(reasons.join(" ")).toContain("não aprovado");
    expect(reasons.join(" ")).toContain("somente prévia");
  });

  it("tem rótulos para todos os estados de cadastro", () => {
    expect(Object.keys(NATIONAL_REGISTRATION_LABELS)).toEqual([
      "nao_solicitado",
      "solicitado",
      "aprovado",
      "recusado",
    ]);
  });
});
