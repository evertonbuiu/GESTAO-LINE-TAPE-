import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge Component", () => {
  it("deve renderizar corretamente", () => {
    const { getByText } = render(<Badge>Status</Badge>);
    expect(getByText("Status")).toBeInTheDocument();
  });

  it("deve aplicar variante default", () => {
    const { getByText } = render(<Badge variant="default">Default</Badge>);
    expect(getByText("Default")).toBeInTheDocument();
  });

  it("deve aplicar variante secondary", () => {
    const { getByText } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(getByText("Secondary")).toBeInTheDocument();
  });

  it("deve aplicar variante destructive", () => {
    const { getByText } = render(<Badge variant="destructive">Error</Badge>);
    expect(getByText("Error")).toBeInTheDocument();
  });

  it("deve aplicar variante outline", () => {
    const { getByText } = render(<Badge variant="outline">Outline</Badge>);
    expect(getByText("Outline")).toBeInTheDocument();
  });
});
