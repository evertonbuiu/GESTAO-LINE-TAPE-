import { describe, it, expect } from "vitest";
import { evaluatePassword } from "@/components/SecuritySettings";

describe("evaluatePassword", () => {
  it("reprova senhas curtas e comuns", () => {
    const r = evaluatePassword("123456");
    expect(r.problems.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(6);
  });

  it("reprova senha que contém o nome de usuário", () => {
    const r = evaluatePassword("Linetape2026!", "linetape");
    expect(r.problems).toContain("Não use seu usuário na senha.");
  });

  it("aprova senha forte", () => {
    const r = evaluatePassword("Tr0vao#Azul92", "admin");
    expect(r.problems).toHaveLength(0);
    expect(r.score).toBe(6);
  });

  it("exige símbolo", () => {
    const r = evaluatePassword("SenhaSegura99", "admin");
    expect(r.problems).toContain("Inclua um símbolo.");
  });
});
