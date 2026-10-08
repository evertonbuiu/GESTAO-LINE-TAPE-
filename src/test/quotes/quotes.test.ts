import { describe, it, expect } from "vitest";
import {
  calculateQuoteTotals,
  roundMoney,
  filterQuotes,
  sortQuotes,
  validateQuoteStep,
  hasMinimumForDocuments,
  buildWhatsAppUrl,
  buildWhatsAppMessage,
  buildDuplicatePayload,
  getQuoteStatusLabel,
  makeItemId,
  resolveStoredQuoteTax,
} from "@/lib/quotes";

describe("calculateQuoteTotals", () => {
  const base = {
    items: [{ quantity: 2, unit_price: 100 }],
    discount_percentage: 0,
    travel_expense: 0,
    accommodation_expense: 0,
    tax_option: "sem_nota" as const,
    tax_percentage: 15,
  };

  it("soma o subtotal dos itens", () => {
    expect(calculateQuoteTotals(base).subtotal).toBe(200);
  });

  it("aplica desconto percentual", () => {
    const totals = calculateQuoteTotals({ ...base, discount_percentage: 10 });
    expect(totals.discount_amount).toBe(20);
    expect(totals.total_amount).toBe(180);
  });

  it("não aplica imposto quando a opção é sem nota", () => {
    expect(calculateQuoteTotals(base).tax_amount).toBe(0);
  });

  it("calcula imposto por dentro quando com nota", () => {
    const totals = calculateQuoteTotals({ ...base, tax_option: "com_nota", tax_percentage: 15 });
    // 200 * 0.15 / 0.85
    expect(totals.tax_amount).toBe(35.29);
    expect(totals.total_amount).toBe(235.29);
  });

  it("soma viagem e hospedagem", () => {
    const totals = calculateQuoteTotals({ ...base, travel_expense: 50, accommodation_expense: 25 });
    expect(totals.total_amount).toBe(275);
  });
});

describe("resolveStoredQuoteTax", () => {
  it("recupera o imposto por dentro de um orçamento antigo pelo total salvo", () => {
    expect(resolveStoredQuoteTax({ subtotal: 20000, total_amount: 23529.41 })).toEqual({
      tax_amount: 3529.41,
      tax_percentage: 15,
    });
  });
});

describe("roundMoney", () => {
  it("arredonda para duas casas", () => {
    expect(roundMoney(10.005)).toBe(10.01);
  });
  it("trata valores inválidos", () => {
    expect(roundMoney(NaN)).toBe(0);
  });
});

const quotes = [
  { id: "1", quote_number: "#001", client_name: "Ana", event_date: "2026-03-10", total_amount: 100, status: "draft", created_at: "2026-01-01", client_phone: "(62) 99999-1111" },
  { id: "2", quote_number: "#002", client_name: "Bruno", event_date: "2026-04-15", total_amount: 300, status: "approved", created_at: "2026-02-01" },
];

describe("filterQuotes", () => {
  it("busca por nome do cliente", () => {
    expect(filterQuotes(quotes, { search: "bru" }).map((q) => q.id)).toEqual(["2"]);
  });
  it("busca por telefone com dígitos", () => {
    expect(filterQuotes(quotes, { search: "999991111" }).map((q) => q.id)).toEqual(["1"]);
  });
  it("filtra por status", () => {
    expect(filterQuotes(quotes, { status: "approved" }).map((q) => q.id)).toEqual(["2"]);
  });
  it("filtra por mês e ano", () => {
    expect(filterQuotes(quotes, { month: "03", year: 2026 }).map((q) => q.id)).toEqual(["1"]);
  });
});

describe("sortQuotes", () => {
  it("ordena por data do evento crescente", () => {
    expect(sortQuotes(quotes, "event_date_asc").map((q) => q.id)).toEqual(["1", "2"]);
  });
  it("ordena por maior valor", () => {
    expect(sortQuotes(quotes, "total_desc").map((q) => q.id)).toEqual(["2", "1"]);
  });
});

describe("validateQuoteStep", () => {
  it("exige cliente e data na etapa 1", () => {
    const result = validateQuoteStep(1, {}, []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
  it("exige itens na etapa 2", () => {
    expect(validateQuoteStep(2, { client_name: "Ana" }, []).valid).toBe(false);
  });
  it("aceita etapa 3 válida", () => {
    expect(validateQuoteStep(3, { discount_percentage: 10 }, [{ quantity: 1, unit_price: 10 }]).valid).toBe(true);
  });
});

describe("hasMinimumForDocuments", () => {
  it("bloqueia sem itens", () => {
    expect(hasMinimumForDocuments({ client_name: "Ana" }, [])).toBe(false);
  });
  it("libera com cliente e itens", () => {
    expect(hasMinimumForDocuments({ client_name: "Ana" }, [{ quantity: 1, unit_price: 1 }])).toBe(true);
  });
});

describe("WhatsApp", () => {
  it("adiciona DDI 55 quando ausente", () => {
    expect(buildWhatsAppUrl("(62) 99999-1111", "oi")).toContain("wa.me/5562999991111");
  });
  it("omite valores quando não permitido", () => {
    const message = buildWhatsAppMessage({ quote_number: "#001", total_amount: 100, showValues: false });
    expect(message).not.toContain("100");
  });
});

describe("buildDuplicatePayload", () => {
  it("remove id e gera novos ids de itens", () => {
    const payload = buildDuplicatePayload(
      { id: "1", created_at: "x", event_id: "e", products: [{ id: "a", name: "Item" }] },
      "#010",
    );
    expect(payload.id).toBeUndefined();
    expect(payload.event_id).toBeUndefined();
    expect(payload.quote_number).toBe("#010");
    expect(payload.status).toBe("draft");
    expect((payload.products as any[])[0].id).not.toBe("a");
  });
});

describe("utilidades", () => {
  it("retorna rótulo do status", () => {
    expect(getQuoteStatusLabel("approved")).toBe("Aprovado");
  });
  it("gera ids únicos", () => {
    expect(makeItemId()).not.toBe(makeItemId());
  });
});
