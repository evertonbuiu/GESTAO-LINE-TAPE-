import { describe, it, expect } from "vitest";
import { normalizeAccountName, findBankAccountByName } from "@/utils/bankAccountMatch";

describe("normalizeAccountName", () => {
  it("deve converter para minúsculo e remover espaços extras", () => {
    expect(normalizeAccountName("  C6  BANK  ")).toBe("c6 bank");
    expect(normalizeAccountName("ITAÚ")).toBe("itaú");
    expect(normalizeAccountName("Conta   Principal")).toBe("conta principal");
  });

  it("deve retornar string vazia para null/undefined", () => {
    expect(normalizeAccountName(null)).toBe("");
    expect(normalizeAccountName(undefined)).toBe("");
  });
});

describe("findBankAccountByName", () => {
  const mockAccounts = [
    { id: "1", name: "C6 BANK" },
    { id: "2", name: "Itaú Conta Corrente" },
    { id: "3", name: "Bradesco PJ" },
  ];

  it("deve encontrar conta por nome exato (case insensitive)", () => {
    const result = findBankAccountByName(mockAccounts, "c6 bank");
    expect(result?.id).toBe("1");
  });

  it("deve encontrar conta por nome parcial", () => {
    const result = findBankAccountByName(mockAccounts, "Itaú");
    expect(result?.id).toBe("2");
  });

  it("deve retornar undefined para nome não encontrado", () => {
    const result = findBankAccountByName(mockAccounts, "Santander");
    expect(result).toBeUndefined();
  });

  it("deve retornar undefined para query vazia", () => {
    const result = findBankAccountByName(mockAccounts, "");
    expect(result).toBeUndefined();
  });
});
