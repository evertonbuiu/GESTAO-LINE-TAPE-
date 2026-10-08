import { describe, expect, it } from "vitest";
import { confidenceOf, scoreMatch, suggestMatches, textSimilarity } from "@/lib/reconciliation";

const source = {
  id: "s",
  description: "Pagamento evento Casamento Silva",
  amount: 1500,
  date: "2026-06-10",
  type: "income" as const,
};

describe("similaridade de descrição", () => {
  it("ignora acentos e palavras curtas", () => {
    expect(textSimilarity("Pagamento Evento", "pagamento evento")).toBe(1);
    expect(textSimilarity("Cabo XLR", "Refletor")).toBe(0);
  });
});

describe("pontuação", () => {
  it("dá nota alta para valor e data idênticos", () => {
    const { score, reasons } = scoreMatch(source, {
      id: "c",
      description: "Evento Casamento Silva",
      amount: 1500,
      date: "2026-06-10",
      type: "income",
    });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(reasons).toContain("Valor idêntico");
    expect(confidenceOf(score)).toBe("alta");
  });

  it("penaliza tipo divergente", () => {
    const same = scoreMatch(source, { ...source, id: "x" }).score;
    const diverging = scoreMatch(source, { ...source, id: "y", type: "expense" }).score;
    expect(diverging).toBeLessThan(same);
  });
});

describe("sugestões", () => {
  it("retorna ordenado e nunca confirma automaticamente", () => {
    const suggestions = suggestMatches(source, [
      { id: "a", description: "Nada a ver", amount: 10, date: "2026-01-01" },
      { id: "b", description: "Casamento Silva sinal", amount: 1500, date: "2026-06-11" },
      { id: "c", description: "Casamento Silva", amount: 1500, date: "2026-06-10" },
    ]);
    expect(suggestions[0].candidate.id).toBe("c");
    expect(suggestions.every((s) => "score" in s && "reasons" in s)).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("descarta candidatos fracos", () => {
    expect(
      suggestMatches(source, [
        { id: "a", description: "Compra material", amount: 42, date: "2025-01-01" },
      ]),
    ).toHaveLength(0);
  });
});
