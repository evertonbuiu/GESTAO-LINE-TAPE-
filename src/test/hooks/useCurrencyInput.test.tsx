import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCurrencyInput, parseCurrencyString, formatCurrencyValue } from "@/hooks/useCurrencyInput";

describe("useCurrencyInput Hook", () => {
  it("deve inicializar com valor zero (string vazia)", () => {
    const { result } = renderHook(() => useCurrencyInput(0));
    expect(result.current.displayValue).toBe("");
    expect(result.current.rawValue).toBe(0);
  });

  it("deve inicializar com valor numérico formatado", () => {
    const { result } = renderHook(() => useCurrencyInput(1234.56));
    expect(result.current.displayValue).toBe("R$\u00A01.234,56");
    expect(result.current.rawValue).toBe(1234.56);
  });

  it("deve atualizar valor via setValue", () => {
    const { result } = renderHook(() => useCurrencyInput(0));
    
    act(() => {
      result.current.setValue(100);
    });
    
    expect(result.current.rawValue).toBe(100);
  });

  it("deve formatar valores grandes corretamente", () => {
    const { result } = renderHook(() => useCurrencyInput(1000000));
    expect(result.current.displayValue).toBe("R$\u00A01.000.000,00");
  });
});

describe("parseCurrencyString", () => {
  it("deve converter string de moeda para número", () => {
    expect(parseCurrencyString("R$ 1.234,56")).toBe(1234.56);
  });

  it("deve retornar 0 para string vazia", () => {
    expect(parseCurrencyString("")).toBe(0);
  });

  it("deve retornar 0 para string inválida", () => {
    expect(parseCurrencyString("abc")).toBe(0);
  });
});

describe("formatCurrencyValue", () => {
  it("deve formatar número para moeda brasileira", () => {
    expect(formatCurrencyValue(1234.56)).toBe("R$\u00A01.234,56");
  });

  it("deve formatar zero corretamente", () => {
    expect(formatCurrencyValue(0)).toBe("R$\u00A00,00");
  });

  it("deve formatar valores grandes", () => {
    expect(formatCurrencyValue(1000000)).toBe("R$\u00A01.000.000,00");
  });
});
