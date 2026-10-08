import { describe, it, expect } from "vitest";
import { sanitize, buildDiagnostics } from "@/lib/errorLogger";

describe("sanitize", () => {
  it("oculta campos sensíveis", () => {
    const out = sanitize({ password: "abc", token: "xyz", nome: "Ana" }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.token).toBe("[REDACTED]");
    expect(out.nome).toBe("Ana");
  });

  it("oculta campos sensíveis aninhados", () => {
    const out = sanitize({ user: { senha: "123", id: 7 } }) as { user: Record<string, unknown> };
    expect(out.user.senha).toBe("[REDACTED]");
    expect(out.user.id).toBe(7);
  });

  it("trunca strings longas", () => {
    const out = sanitize("x".repeat(2000)) as string;
    expect(out.length).toBeLessThanOrEqual(1001);
  });
});

describe("buildDiagnostics", () => {
  it("inclui mensagem e contexto sanitizado", () => {
    const d = buildDiagnostics({ message: "falhou", context: { apikey: "s3cr3t", tela: "eventos" } });
    expect(d.message).toBe("falhou");
    expect((d.context as Record<string, unknown>).apikey).toBe("[REDACTED]");
    expect((d.context as Record<string, unknown>).tela).toBe("eventos");
  });
});
