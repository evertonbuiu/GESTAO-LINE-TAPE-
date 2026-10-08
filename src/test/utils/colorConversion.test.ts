import { describe, it, expect } from "vitest";
import { hexToHsl, hslToHex } from "@/utils/colorConversion";

describe("hexToHsl", () => {
  it("deve converter preto corretamente", () => {
    const result = hexToHsl("#000000");
    expect(result).toBe("0 0% 0%");
  });

  it("deve converter branco corretamente", () => {
    const result = hexToHsl("#FFFFFF");
    expect(result).toBe("0 0% 100%");
  });

  it("deve converter vermelho corretamente", () => {
    const result = hexToHsl("#FF0000");
    expect(result).toBe("0 100% 50%");
  });

  it("deve converter azul corretamente", () => {
    const result = hexToHsl("#0000FF");
    expect(result).toBe("240 100% 50%");
  });

  it("deve converter verde corretamente", () => {
    const result = hexToHsl("#00FF00");
    expect(result).toBe("120 100% 50%");
  });
});

describe("hslToHex", () => {
  it("deve converter preto corretamente", () => {
    expect(hslToHex("0 0% 0%").toUpperCase()).toBe("#000000");
  });

  it("deve converter branco corretamente", () => {
    expect(hslToHex("0 0% 100%").toUpperCase()).toBe("#FFFFFF");
  });

  it("deve converter vermelho corretamente", () => {
    expect(hslToHex("0 100% 50%").toUpperCase()).toBe("#FF0000");
  });
});
