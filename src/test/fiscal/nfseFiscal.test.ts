import { describe, it, expect } from "vitest";
import {
  PROVIDER_FISCAL_DEFAULTS,
  SERVICE_CODE_OPTIONS,
  shouldWarnServiceDescription,
  serviceDescriptionWarning,
  validateProviderFiscalDefaults,
  findServiceCodeOption,
} from "@/lib/nfseFiscal";

describe("padrões fiscais do prestador", () => {
  it("usa os dados confirmados na NFS-e autorizada", () => {
    expect(PROVIDER_FISCAL_DEFAULTS).toMatchObject({
      provider_cnpj: "42089948000105",
      provider_im: "5412455",
      municipality_code: "5208707",
      rps_series: "1",
      service_code: "12.12",
      cnae_code: "9001906",
      iss_rate: 2.0,
      iss_retention: false,
      simple_national: true,
      service_exigibility: 1,
    });
  });

  it("oferece 12.12 como opção e permite outros códigos", () => {
    expect(findServiceCodeOption("12.12")?.label).toContain("Execução de música");
    expect(SERVICE_CODE_OPTIONS.length).toBeGreaterThan(1);
    expect(findServiceCodeOption("99.99")).toBeUndefined();
  });
});

describe("validação do preflight", () => {
  it("aprova configuração alinhada ao SGISS", () => {
    expect(
      validateProviderFiscalDefaults({
        provider_im: "5412455",
        rps_series: "1",
        default_service_code: "12.12",
      })
    ).toEqual([]);
  });

  it("bloqueia IM, série e código divergentes", () => {
    const errors = validateProviderFiscalDefaults({
      provider_im: "999",
      rps_series: "RPS",
      default_service_code: "99.99",
    });
    expect(errors).toHaveLength(3);
    expect(errors.join(" ")).toContain("5412455");
    expect(errors.join(" ")).toContain("12.12");
  });
});

describe("alerta de descrição x código de serviço", () => {
  it("não alerta quando a descrição combina com 12.12", () => {
    expect(shouldWarnServiceDescription("12.12", "Execução de música ao vivo com sonorização")).toBe(false);
    expect(serviceDescriptionWarning("12.12", "Show musical com banda")).toBeNull();
  });

  it("alerta quando a descrição não corresponde ao 12.12", () => {
    expect(shouldWarnServiceDescription("12.12", "Consultoria contábil mensal")).toBe(true);
    expect(serviceDescriptionWarning("12.12", "Consultoria contábil mensal")).toContain("12.12");
  });

  it("ignora acentos e maiúsculas", () => {
    expect(shouldWarnServiceDescription("12.12", "EXECUÇÃO MUSICAL EM EVENTO")).toBe(false);
  });

  it("não alerta para descrição vazia nem para código fora do catálogo", () => {
    expect(shouldWarnServiceDescription("12.12", "")).toBe(false);
    expect(shouldWarnServiceDescription("99.99", "Qualquer coisa")).toBe(false);
  });
});
