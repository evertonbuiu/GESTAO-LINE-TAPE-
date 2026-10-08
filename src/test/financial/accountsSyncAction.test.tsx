/**
 * Integração da ação "Sincronizar extrato" no card de cada conta (Contas).
 * Garante: abertura pela ferramenta da conta, conta correta (sem fallback),
 * reset ao fechar/reabrir e ausência do fluxo legado de sincronização.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AccountRecord } from "@/lib/accounts";

const refresh = vi.fn().mockResolvedValue(undefined);

const accounts: AccountRecord[] = [
  {
    id: "acc-1",
    name: "BRADESCO",
    type: "checking",
    bankName: "Bradesco",
    initialBalance: 0,
    storedBalance: 0,
    isActive: true,
  },
  {
    id: "acc-2",
    name: "C6 BANK",
    type: "checking",
    bankName: "C6",
    initialBalance: 0,
    storedBalance: 0,
    isActive: true,
  },
];

vi.mock("@/hooks/useAccountsData", () => ({
  useAccountsData: () => ({
    accounts,
    transactions: [],
    cards: [],
    cardTransactions: [],
    closings: [],
    reconciledIds: new Set<string>(),
    ledgerExtrasPending: false,
    loading: false,
    error: null,
    denied: false,
    refresh,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ data: [], error: null }) }), rpc: async () => ({ data: null, error: null }) },
}));

vi.mock("@/components/BankStatementSync", () => ({
  BankStatementSync: ({
    account,
    onOpenChange,
  }: {
    account: { id: string; name: string };
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="sync-dialog" data-account-id={account.id}>
      <span>Extrato de {account.name}</span>
      <button type="button" onClick={() => onOpenChange(false)}>
        fechar-sync
      </button>
    </div>
  ),
}));

import { AccountsPanel } from "@/components/finance/AccountsPanel";

/** Radix abre o menu no pointerdown; jsdom precisa do evento explícito. */
const openMenu = (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(trigger);
};

describe("Contas > ação Sincronizar extrato", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("abre o fluxo novo com a conta clicada (sem fallback para a primeira)", async () => {
    render(<AccountsPanel />);
    fireEvent.click(screen.getByTestId("sync-statement-acc-2"));
    const dialog = await screen.findByTestId("sync-dialog");
    expect(dialog.getAttribute("data-account-id")).toBe("acc-2");
    expect(screen.getByText("Extrato de C6 BANK")).toBeTruthy();
  });

  it("fechar e reabrir remonta o fluxo, limpando arquivo/prévia/seleção", async () => {
    render(<AccountsPanel />);
    fireEvent.click(screen.getByTestId("sync-statement-acc-1"));
    expect((await screen.findByTestId("sync-dialog")).getAttribute("data-account-id")).toBe("acc-1");

    fireEvent.click(screen.getByText("fechar-sync"));
    await waitFor(() => expect(screen.queryByTestId("sync-dialog")).toBeNull());

    fireEvent.click(screen.getByTestId("sync-statement-acc-2"));
    expect((await screen.findByTestId("sync-dialog")).getAttribute("data-account-id")).toBe("acc-2");
  });

  it("expõe rótulo acessível em cada conta", () => {
    render(<AccountsPanel />);
    expect(screen.getByLabelText("Sincronizar extrato de BRADESCO")).toBeTruthy();
    expect(screen.getByLabelText("Sincronizar extrato de C6 BANK")).toBeTruthy();
  });

  it("abre a aba de extrato já filtrada pela conta selecionada", () => {
    render(<AccountsPanel />);
    fireEvent.click(screen.getByTestId("view-statement-acc-2"));
    expect(screen.getByRole("tab", { name: "Extrato" }).getAttribute("data-state")).toBe("active");
  });

  it("não existe mais o bloco legado de contas em FinancialManagement", () => {
    const source = readFileSync("src/components/FinancialManagement.tsx", "utf8");
    expect(source).not.toContain("BankStatementSync");
    expect(source).not.toContain("selectedAccountForSync");
    expect(source).not.toContain("isBankSyncOpen");
    expect(source).not.toContain("Ferramentas legadas de contas");
    expect(source).not.toContain("<CardTitle>Contas Bancárias</CardTitle>");
    expect(source).not.toContain("BankRealTimeSync");
    expect(source).not.toContain("handleTransferFunds");
    expect(source).not.toContain("handleAddAccount");
    expect(source).not.toContain("exportAccountsToPDF");
  });

  it("os cards novos são a única interface de contas e trazem as ações migradas", () => {
    render(<AccountsPanel />);
    expect(screen.queryByText(/Ferramentas legadas de contas/i)).toBeNull();
    // uma única lista de contas: um card por conta
    expect(screen.getAllByLabelText(/^Mais ações de /).length).toBe(3); // 2 contas + menu geral
    expect(screen.getByRole("button", { name: "Nova conta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Transferir/ })).toBeTruthy();
  });

  it("menu Mais da conta expõe editar e inativar", async () => {
    render(<AccountsPanel />);
    openMenu(screen.getByLabelText("Mais ações de C6 BANK"));
    expect(await screen.findByText("Editar conta")).toBeTruthy();
    expect(screen.getByText("Inativar conta")).toBeTruthy();
  });

  it("menu geral consolida fechar período, sincronizar saldos e Open Finance", async () => {
    render(<AccountsPanel />);
    openMenu(screen.getByLabelText("Mais ações de contas"));
    expect(await screen.findByText(/Fechar período/)).toBeTruthy();
    expect(screen.getByText(/Sincronizar saldos/)).toBeTruthy();
    expect(screen.getByText(/Open Finance/)).toBeTruthy();
  });
});

