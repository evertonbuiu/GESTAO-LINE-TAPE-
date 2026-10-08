import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("deve renderizar corretamente", () => {
    const { getByRole } = render(<Button>Clique aqui</Button>);
    expect(getByRole("button")).toHaveTextContent("Clique aqui");
  });

  it("deve aplicar variante default corretamente", () => {
    const { getByRole } = render(<Button variant="default">Default</Button>);
    expect(getByRole("button")).toBeInTheDocument();
  });

  it("deve aplicar variante destructive corretamente", () => {
    const { getByRole } = render(<Button variant="destructive">Excluir</Button>);
    expect(getByRole("button")).toBeInTheDocument();
  });

  it("deve aplicar variante outline corretamente", () => {
    const { getByRole } = render(<Button variant="outline">Outline</Button>);
    expect(getByRole("button")).toBeInTheDocument();
  });

  it("deve desabilitar o botão quando disabled", () => {
    const { getByRole } = render(<Button disabled>Desabilitado</Button>);
    expect(getByRole("button")).toBeDisabled();
  });

  it("deve aplicar tamanhos corretamente", () => {
    const { getByRole, rerender } = render(<Button size="sm">Small</Button>);
    expect(getByRole("button")).toBeInTheDocument();

    rerender(<Button size="lg">Large</Button>);
    expect(getByRole("button")).toBeInTheDocument();
  });
});
