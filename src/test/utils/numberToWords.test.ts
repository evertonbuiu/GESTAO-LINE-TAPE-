import { describe, it, expect } from "vitest";
import { numberToWords } from "@/utils/numberToWords";

describe("numberToWords - Conversão de números para extenso", () => {
  it("deve converter zero corretamente", () => {
    expect(numberToWords(0)).toBe("zero reais");
  });

  it("deve converter unidades corretamente", () => {
    expect(numberToWords(1)).toBe("um real");
    expect(numberToWords(5)).toBe("cinco reais");
    expect(numberToWords(9)).toBe("nove reais");
  });

  it("deve converter dezenas corretamente", () => {
    expect(numberToWords(10)).toBe("dez reais");
    expect(numberToWords(15)).toBe("quinze reais");
    expect(numberToWords(21)).toBe("vinte e um reais");
    expect(numberToWords(99)).toBe("noventa e nove reais");
  });

  it("deve converter centenas corretamente", () => {
    expect(numberToWords(100)).toBe("cem reais");
    expect(numberToWords(101)).toBe("cento e um reais");
    expect(numberToWords(200)).toBe("duzentos reais");
    expect(numberToWords(999)).toBe("novecentos e noventa e nove reais");
  });

  it("deve converter milhares corretamente", () => {
    expect(numberToWords(1000)).toBe("mil reais");
    expect(numberToWords(2500)).toBe("dois mil quinhentos reais");
    expect(numberToWords(10000)).toBe("dez mil reais");
  });

  it("deve converter milhões corretamente", () => {
    expect(numberToWords(1000000)).toBe("um milhão reais");
    expect(numberToWords(2000000)).toBe("dois milhões reais");
  });

  it("deve converter centavos corretamente", () => {
    expect(numberToWords(0.01)).toBe("um centavo");
    expect(numberToWords(0.50)).toBe("cinquenta centavos");
    expect(numberToWords(1.99)).toBe("um real e noventa e nove centavos");
  });

  it("deve converter valores complexos corretamente", () => {
    expect(numberToWords(1234.56)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
  });
});
