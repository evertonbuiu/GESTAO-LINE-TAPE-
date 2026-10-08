import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input Component", () => {
  it("deve renderizar corretamente", () => {
    const { getByPlaceholderText } = render(<Input placeholder="Digite aqui" />);
    expect(getByPlaceholderText("Digite aqui")).toBeInTheDocument();
  });

  it("deve aceitar entrada de texto", () => {
    const { getByTestId } = render(<Input data-testid="test-input" />);
    const input = getByTestId("test-input") as HTMLInputElement;
    
    // Simula mudança de valor
    input.value = "Texto de teste";
    expect(input.value).toBe("Texto de teste");
  });

  it("deve desabilitar input quando disabled", () => {
    const { getByTestId } = render(<Input disabled data-testid="disabled-input" />);
    expect(getByTestId("disabled-input")).toBeDisabled();
  });

  it("deve aplicar tipo corretamente", () => {
    const { getByTestId } = render(<Input type="password" data-testid="password-input" />);
    expect(getByTestId("password-input")).toHaveAttribute("type", "password");
  });

  it("deve aplicar className customizado", () => {
    const { getByTestId } = render(<Input className="custom-class" data-testid="custom-input" />);
    expect(getByTestId("custom-input")).toHaveClass("custom-class");
  });
});
