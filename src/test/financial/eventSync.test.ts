import { describe, it, expect } from "vitest";

// Tipos simulados
interface Quote {
  id: string;
  event_id?: string;
  client_name: string;
  total_amount: number;
  products: Array<{ name: string; quantity: number; price: number }>;
}

interface Event {
  id: string;
  name: string;
  client_name: string;
  total_budget: number;
}

interface EventBudget {
  event_id: string;
  item: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Funções de sincronização simuladas
const shouldSyncToEvent = (quote: Quote): boolean => {
  return !!quote.event_id;
};

const mapQuoteToEventUpdate = (quote: Quote): Partial<Event> => {
  return {
    name: `Evento - ${quote.client_name}`,
    client_name: quote.client_name,
    total_budget: quote.total_amount,
  };
};

const mapProductsToEventBudgets = (
  eventId: string,
  products: Quote["products"]
): EventBudget[] => {
  return products.map((p) => ({
    event_id: eventId,
    item: p.name,
    quantity: p.quantity,
    unit_price: p.price,
    total_price: p.quantity * p.price,
  }));
};

describe("Sincronização Orçamento → Evento", () => {
  describe("shouldSyncToEvent", () => {
    it("deve retornar true se orçamento tem event_id", () => {
      const quote: Quote = {
        id: "q1",
        event_id: "e1",
        client_name: "Cliente",
        total_amount: 1000,
        products: [],
      };
      expect(shouldSyncToEvent(quote)).toBe(true);
    });

    it("deve retornar false se orçamento não tem event_id", () => {
      const quote: Quote = {
        id: "q1",
        client_name: "Cliente",
        total_amount: 1000,
        products: [],
      };
      expect(shouldSyncToEvent(quote)).toBe(false);
    });
  });

  describe("mapQuoteToEventUpdate", () => {
    it("deve mapear dados do orçamento para evento corretamente", () => {
      const quote: Quote = {
        id: "q1",
        event_id: "e1",
        client_name: "João Silva",
        total_amount: 5000,
        products: [],
      };

      const eventUpdate = mapQuoteToEventUpdate(quote);

      expect(eventUpdate.name).toBe("Evento - João Silva");
      expect(eventUpdate.client_name).toBe("João Silva");
      expect(eventUpdate.total_budget).toBe(5000);
    });
  });

  describe("mapProductsToEventBudgets", () => {
    it("deve converter produtos do orçamento para event_budgets", () => {
      const products = [
        { name: "LED 5m", quantity: 10, price: 50 },
        { name: "Refletor", quantity: 5, price: 100 },
      ];

      const budgets = mapProductsToEventBudgets("event-123", products);

      expect(budgets).toHaveLength(2);
      expect(budgets[0].item).toBe("LED 5m");
      expect(budgets[0].total_price).toBe(500);
      expect(budgets[1].item).toBe("Refletor");
      expect(budgets[1].total_price).toBe(500);
    });

    it("deve calcular total_price corretamente", () => {
      const products = [{ name: "Produto", quantity: 3, price: 33.33 }];
      const budgets = mapProductsToEventBudgets("e1", products);
      
      expect(budgets[0].total_price).toBeCloseTo(99.99, 2);
    });

    it("deve retornar array vazio para produtos vazios", () => {
      const budgets = mapProductsToEventBudgets("e1", []);
      expect(budgets).toHaveLength(0);
    });
  });
});

describe("Cálculos de Orçamento", () => {
  it("deve calcular subtotal corretamente", () => {
    const products = [
      { name: "A", quantity: 2, price: 100 },
      { name: "B", quantity: 3, price: 50 },
    ];
    
    const subtotal = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
    expect(subtotal).toBe(350);
  });

  it("deve calcular desconto percentual corretamente", () => {
    const subtotal = 1000;
    const discountPercent = 10;
    const discount = subtotal * (discountPercent / 100);
    
    expect(discount).toBe(100);
  });

  it("deve calcular taxa de nota fiscal corretamente", () => {
    const subtotal = 1000;
    const taxRate = 15;
    const tax = subtotal * (taxRate / 100);
    
    expect(tax).toBe(150);
  });

  it("deve calcular total final com desconto e taxa", () => {
    const subtotal = 1000;
    const discountPercent = 10;
    const taxRate = 15;
    
    const discount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (taxRate / 100);
    const total = afterDiscount + tax;
    
    expect(total).toBe(1035); // 1000 - 100 + 135 = 1035
  });
});
