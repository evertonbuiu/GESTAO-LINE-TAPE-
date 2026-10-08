import { describe, it, expect } from "vitest";

// Simulação das funções de cálculo de saldo
const calculateBalance = (transactions: Array<{ type: 'income' | 'expense', amount: number }>) => {
  return transactions.reduce((sum, t) => {
    return t.type === 'income' ? sum + t.amount : sum - t.amount;
  }, 0);
};

const hasMatchingTransaction = (
  transactions: Array<{ amount: number, date: string }>,
  targetAmount: number,
  targetDate: string
) => {
  return transactions.some(
    (t) => t.amount === targetAmount && t.date === targetDate
  );
};

describe("Cálculo de Saldo Financeiro", () => {
  describe("calculateBalance", () => {
    it("deve calcular saldo com apenas receitas", () => {
      const transactions = [
        { type: 'income' as const, amount: 1000 },
        { type: 'income' as const, amount: 500 },
      ];
      expect(calculateBalance(transactions)).toBe(1500);
    });

    it("deve calcular saldo com apenas despesas", () => {
      const transactions = [
        { type: 'expense' as const, amount: 200 },
        { type: 'expense' as const, amount: 300 },
      ];
      expect(calculateBalance(transactions)).toBe(-500);
    });

    it("deve calcular saldo com receitas e despesas", () => {
      const transactions = [
        { type: 'income' as const, amount: 1000 },
        { type: 'expense' as const, amount: 300 },
        { type: 'income' as const, amount: 500 },
        { type: 'expense' as const, amount: 200 },
      ];
      expect(calculateBalance(transactions)).toBe(1000);
    });

    it("deve retornar zero para lista vazia", () => {
      expect(calculateBalance([])).toBe(0);
    });
  });

  describe("hasMatchingTransaction (Deduplicação)", () => {
    const transactions = [
      { amount: 1000, date: "2025-01-15" },
      { amount: 500, date: "2025-01-20" },
    ];

    it("deve encontrar transação correspondente", () => {
      expect(hasMatchingTransaction(transactions, 1000, "2025-01-15")).toBe(true);
    });

    it("deve retornar false para valor diferente", () => {
      expect(hasMatchingTransaction(transactions, 999, "2025-01-15")).toBe(false);
    });

    it("deve retornar false para data diferente", () => {
      expect(hasMatchingTransaction(transactions, 1000, "2025-01-16")).toBe(false);
    });

    it("deve retornar false para lista vazia", () => {
      expect(hasMatchingTransaction([], 1000, "2025-01-15")).toBe(false);
    });
  });
});

describe("Sincronização de Transações", () => {
  it("deve identificar transações duplicadas por reference_id", () => {
    const transactions = [
      { id: "1", reference_type: "event_income", reference_id: "event-123" },
      { id: "2", reference_type: "expense", reference_id: "expense-456" },
    ];

    const eventPayment = { id: "event-123" };
    const isDuplicate = transactions.some(
      (t) => t.reference_type === "event_income" && t.reference_id === eventPayment.id
    );
    
    expect(isDuplicate).toBe(true);
  });

  it("deve não duplicar transações já sincronizadas", () => {
    const existingTransactions = [
      { reference_type: "event_income", reference_id: "event-123", amount: 1000 },
    ];

    const newEventPayment = { id: "event-123", amount: 1000 };
    const alreadySynced = existingTransactions.some(
      (t) => t.reference_id === newEventPayment.id
    );

    expect(alreadySynced).toBe(true);
  });
});
