/**
 * Painel de CONTAS (Gestão Financeira).
 *
 * Escopo: contas bancárias, cartões, saldos, extrato, transferências,
 * conciliação manual, estorno e fechamento de período.
 * Não duplica Contas a Pagar/Receber nem a área de Relatórios.
 */

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeftRight,
  CreditCard,
  Download,
  FileUp,
  Lock,
  MoreHorizontal,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Link2,
  ReceiptText,
} from "lucide-react";
import { BankRealTimeSync } from "@/components/BankRealTimeSync";

import { BankStatementSync } from "@/components/BankStatementSync";
import { BankTransactionLinkDialog } from "@/components/finance/BankTransactionLinkDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAccountsData } from "@/hooks/useAccountsData";
import { KpiCard, ReportTable, SectionState, type ReportColumn } from "@/components/reports/ReportPrimitives";
import { downloadReportCsv, printReport } from "@/lib/reportExport";
import { formatBRL, todaySaoPaulo } from "@/lib/finance";
import { formatTransactionDateTime } from "@/lib/transactionDateTime";
import { addDays, formatDateBR, resolvePeriod, type DateRange, type PeriodPreset } from "@/lib/reports";
import {
  buildReversalRow,
  buildTransferRows,
  canDeleteAccount,
  closedThroughFor,
  filterStatement,
  groupTransfers,
  isTransferTx,
  listCategories,
  openingBalanceAt,
  summarizeAccount,
  summarizeCard,
  totalBalance,
  toExportRows,
  TX_STATUS_LABEL,
  txStatus,
  validateAccount,
  validateCard,
  validateClosing,
  validateReversal,
  validateTransfer,
  withRunningBalance,
  type AccountBalanceSummary,
  type AccountRecord,
  type AccountTx,
  type TxStatus,
  type TxType,
} from "@/lib/accounts";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  cash: "Caixa",
};

interface StatementRow extends AccountTx {
  runningBalance: number;
  contaNome: string;
  statusLabel: string;
  valorAssinado: number;
  origem: string;
}

const emptyAccountForm = {
  id: "",
  name: "",
  type: "checking" as AccountRecord["type"],
  bankName: "",
  agency: "",
  accountNumber: "",
  initialBalance: 0,
  isActive: true,
};

const emptyCardForm = {
  id: "",
  name: "",
  cardNumber: "",
  cardType: "credit" as "credit" | "debit",
  bank: "",
  limitAmount: 0,
  isActive: true,
};

export const AccountsPanel = () => {
  const { toast } = useToast();
  const data = useAccountsData();
  const today = todaySaoPaulo();

  /* ------------------------------------------------------------ filtros */
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [custom, setCustom] = useState<DateRange>({ start: today, end: today });
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TxType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TxStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState("visao");
  const [linkTransaction, setLinkTransaction] = useState<AccountTx | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);

  const openC6Receipt = useCallback(async (transaction: AccountTx) => {
    if (!transaction.receiptUrl) return;
    const receiptWindow = window.open("", "_blank", "noopener,noreferrer");
    setReceiptLoadingId(transaction.id);
    try {
      const { data: receipt, error } = await supabase.functions.invoke("c6-receipt", {
        body: { receipt_path: transaction.receiptUrl },
      });
      if (error || !(receipt instanceof Blob)) throw error ?? new Error("Comprovante inválido");
      const objectUrl = URL.createObjectURL(receipt);
      if (receiptWindow) receiptWindow.location.href = objectUrl;
      else window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      receiptWindow?.close();
      toast({ title: "Comprovante indisponível", description: "Não foi possível carregar o comprovante no C6.", variant: "destructive" });
    } finally {
      setReceiptLoadingId(null);
    }
  }, [toast]);

  const range = useMemo(
    () => (preset === "custom" ? custom : resolvePeriod(preset, undefined, today)),
    [preset, custom, today],
  );

  /* ------------------------------------------------------------- saldos */
  const summaries = useMemo(() => {
    const map = new Map<string, AccountBalanceSummary>();
    data.accounts.forEach((acc) => map.set(acc.id, summarizeAccount(acc, data.transactions, today)));
    return map;
  }, [data.accounts, data.transactions, today]);

  const visibleAccounts = useMemo(
    () => data.accounts.filter((a) => showInactive || a.isActive),
    [data.accounts, showInactive],
  );

  const accountName = useCallback(
    (id: string | null) => data.accounts.find((a) => a.id === id)?.name ?? "Sem conta",
    [data.accounts],
  );

  const filtered = useMemo(
    () =>
      filterStatement(
        data.transactions,
        {
          range,
          accountIds: accountFilter === "all" ? undefined : [accountFilter],
          type: typeFilter,
          status: statusFilter,
          categories: categoryFilter === "all" ? undefined : [categoryFilter],
        },
        data.reconciledIds,
        today,
      ),
    [data.transactions, data.reconciledIds, range, accountFilter, typeFilter, statusFilter, categoryFilter, today],
  );

  const statementRows: StatementRow[] = useMemo(() => {
    const opening =
      accountFilter === "all"
        ? 0
        : (() => {
            const acc = data.accounts.find((a) => a.id === accountFilter);
            return acc ? openingBalanceAt(acc, data.transactions, range.start) : 0;
          })();
    return withRunningBalance(filtered, opening)
      .map((tx) => ({
        ...tx,
        contaNome: accountName(tx.accountId),
        statusLabel: TX_STATUS_LABEL[txStatus(tx, data.reconciledIds, today)],
        valorAssinado: tx.type === "income" ? tx.amount : -tx.amount,
        origem: tx.referenceType ? tx.referenceType : "Manual",
      }))
      .reverse();
  }, [filtered, accountFilter, data.accounts, data.transactions, data.reconciledIds, range.start, accountName, today]);

  const periodTotals = useMemo(() => {
    const income = filtered
      .filter((t) => t.type === "income" && !isTransferTx(t))
      .reduce((a, t) => a + t.amount, 0);
    const expense = filtered
      .filter((t) => t.type === "expense" && !isTransferTx(t))
      .reduce((a, t) => a + t.amount, 0);
    const transfers = groupTransfers(filtered);
    return { income, expense, net: income - expense, transfers };
  }, [filtered]);

  const totals = useMemo(() => {
    const list = visibleAccounts.map((a) => summaries.get(a.id)!).filter(Boolean);
    const divergence = list.reduce((a, s) => a + Math.abs(s.divergence), 0);
    return {
      balance: totalBalance(list),
      available: list.reduce((a, s) => a + s.available, 0),
      divergence,
    };
  }, [visibleAccounts, summaries]);

  const categories = useMemo(() => listCategories(data.transactions), [data.transactions]);

  /* ------------------------------------------------------- transferência */
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferStep, setTransferStep] = useState<"form" | "confirm">("form");
  const [transfer, setTransfer] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: 0,
    date: today,
    description: "",
  });
  const [busy, setBusy] = useState(false);
  /** Conta selecionada para sincronizar extrato (fluxo OFX/CSV/XLSX). */
  const [syncAccount, setSyncAccount] = useState<AccountRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  /** Recálculo de saldos armazenados (RPC) e tela informativa de Open Finance. */
  const [recalculating, setRecalculating] = useState(false);
  const [openFinanceOpen, setOpenFinanceOpen] = useState(false);

  const recalculateBalances = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.rpc("force_sync_all_balances");
      if (error) throw error;
      await data.refresh();
      toast({ title: "Saldos sincronizados", description: "Os saldos armazenados foram recalculados." });
    } catch (error) {
      toast({
        title: "Erro ao sincronizar saldos",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };



  const transferCheck = useMemo(
    () =>
      validateTransfer(transfer, data.accounts, summaries, (id) =>
        closedThroughFor(data.closings, id),
      ),
    [transfer, data.accounts, summaries, data.closings],
  );

  const submitTransfer = async () => {
    if (!transferCheck.ok) return;
    setBusy(true);
    try {
      const groupId = crypto.randomUUID();
      const rows = buildTransferRows(
        transfer,
        accountName(transfer.fromAccountId),
        accountName(transfer.toAccountId),
        groupId,
      );
      const { error } = await supabase.from("bank_transactions").insert(rows as never);
      if (error) throw error;
      toast({ title: "Transferência registrada", description: "As duas pernas foram lançadas com rastreabilidade." });
      setTransferOpen(false);
      setTransferStep("form");
      setTransfer({ fromAccountId: "", toAccountId: "", amount: 0, date: today, description: "" });
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro na transferência",
        description: e instanceof Error ? e.message : "Não foi possível transferir.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------- conta */
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const accountCheck = useMemo(
    () =>
      validateAccount(
        { name: accountForm.name, type: accountForm.type, initialBalance: accountForm.initialBalance },
        data.accounts,
        accountForm.id || undefined,
      ),
    [accountForm, data.accounts],
  );

  const saveAccount = async () => {
    if (!accountCheck.ok) return;
    setBusy(true);
    try {
      const payload = {
        name: accountForm.name.trim(),
        account_type: accountForm.type,
        bank_name: accountForm.bankName.trim() || null,
        agency: accountForm.agency.trim() || null,
        account_number: accountForm.accountNumber.trim() || null,
        initial_balance: accountForm.initialBalance,
        is_active: accountForm.isActive,
      };
      const { error } = accountForm.id
        ? await supabase.from("bank_accounts").update(payload as never).eq("id", accountForm.id)
        : await supabase.from("bank_accounts").insert(payload as never);
      if (error) throw error;
      toast({ title: accountForm.id ? "Conta atualizada" : "Conta criada" });
      setAccountOpen(false);
      setAccountForm(emptyAccountForm);
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro ao salvar conta",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const [inactivateTarget, setInactivateTarget] = useState<AccountRecord | null>(null);
  const toggleAccountActive = async (account: AccountRecord, next: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("bank_accounts")
        .update({ is_active: next } as never)
        .eq("id", account.id);
      if (error) throw error;
      toast({ title: next ? "Conta reativada" : "Conta inativada", description: "O histórico foi preservado." });
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível atualizar a conta.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setInactivateTarget(null);
    }
  };

  /* ------------------------------------------------------------ cartões */
  const [cardOpen, setCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const cardCheck = useMemo(
    () =>
      validateCard(
        { name: cardForm.name, cardNumber: cardForm.cardNumber, limitAmount: cardForm.limitAmount },
        data.cards,
        cardForm.id || undefined,
      ),
    [cardForm, data.cards],
  );

  const saveCard = async () => {
    if (!cardCheck.ok) return;
    setBusy(true);
    try {
      const digits = cardForm.cardNumber.replace(/\D/g, "").slice(-4);
      const payload = {
        name: cardForm.name.trim(),
        card_number: `****${digits}`,
        card_type: cardForm.cardType,
        bank: cardForm.bank.trim() || cardForm.name.trim(),
        limit_amount: cardForm.limitAmount || null,
        is_active: cardForm.isActive,
      };
      const { error } = cardForm.id
        ? await supabase.from("bank_cards").update(payload as never).eq("id", cardForm.id)
        : await supabase.from("bank_cards").insert(payload as never);
      if (error) throw error;
      toast({ title: cardForm.id ? "Cartão atualizado" : "Cartão criado" });
      setCardOpen(false);
      setCardForm(emptyCardForm);
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro ao salvar cartão",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ estorno */
  const [reversalTarget, setReversalTarget] = useState<AccountTx | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const confirmReversal = async () => {
    if (!reversalTarget) return;
    const check = validateReversal(
      reversalTarget,
      data.transactions,
      closedThroughFor(data.closings, reversalTarget.accountId ?? ""),
    );
    if (!check.ok) {
      toast({ title: "Estorno bloqueado", description: check.errors.join(" "), variant: "destructive" });
      setReversalTarget(null);
      return;
    }
    setBusy(true);
    try {
      const row = buildReversalRow(reversalTarget, today, reversalReason);
      const { error } = await supabase.from("bank_transactions").insert(row as never);
      if (error) throw error;
      toast({ title: "Estorno registrado", description: "O lançamento original foi preservado." });
      setReversalTarget(null);
      setReversalReason("");
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro ao estornar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------- conciliação */
  const toggleReconciled = async (tx: AccountTx) => {
    if (data.ledgerExtrasPending) {
      toast({
        title: "Recurso aguardando migração",
        description: "A conciliação manual exige a migração de banco apresentada para aprovação.",
      });
      return;
    }
    const already = data.reconciledIds.has(tx.id);
    try {
      const { error } = already
        ? await supabase
            .from("bank_transaction_reconciliations" as never)
            .delete()
            .eq("bank_transaction_id", tx.id)
        : await supabase
            .from("bank_transaction_reconciliations" as never)
            .insert({ bank_transaction_id: tx.id } as never);
      if (error) throw error;
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro na conciliação",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  /* ------------------------------------------------------- fechamento */
  const [closingOpen, setClosingOpen] = useState(false);
  const [closingForm, setClosingForm] = useState({ accountId: "", closedThrough: today, notes: "" });
  const closingCheck = useMemo(
    () => validateClosing(closingForm.accountId, closingForm.closedThrough, data.closings, today),
    [closingForm, data.closings, today],
  );

  const submitClosing = async () => {
    if (!closingCheck.ok || !closingForm.accountId) return;
    if (data.ledgerExtrasPending) {
      toast({
        title: "Recurso aguardando migração",
        description: "O fechamento por período exige a migração apresentada para aprovação.",
      });
      return;
    }
    setBusy(true);
    try {
      const account = data.accounts.find((a) => a.id === closingForm.accountId)!;
      // saldo até o fim do dia fechado (abertura do dia seguinte)
      const balance = openingBalanceAt(
        account,
        data.transactions,
        addDays(closingForm.closedThrough, 1),
      );
      const { error } = await supabase.from("bank_account_closings" as never).insert({
        bank_account_id: closingForm.accountId,
        closed_through: closingForm.closedThrough,
        closing_balance: balance,
        notes: closingForm.notes || null,
      } as never);
      if (error) throw error;
      toast({ title: "Período fechado", description: "Novos lançamentos anteriores ficam bloqueados." });
      setClosingOpen(false);
      await data.refresh();
    } catch (e) {
      toast({
        title: "Erro ao fechar período",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------- exportação */
  const exportCsv = () => {
    const rows = toExportRows(
      withRunningBalance(filtered, 0),
      accountName,
      data.reconciledIds,
      today,
    );
    downloadReportCsv("extrato-contas", range, rows, [
      { key: "data", label: "Data e hora", value: (r) => formatTransactionDateTime(r.data, r.time, r.createdAt) },
      { key: "conta", label: "Conta", value: (r) => r.conta },
      { key: "descricao", label: "Descrição", value: (r) => r.descricao },
      { key: "categoria", label: "Categoria", value: (r) => r.categoria },
      { key: "tipo", label: "Tipo", value: (r) => r.tipo },
      { key: "status", label: "Status", value: (r) => r.status },
      { key: "valor", label: "Valor", value: (r) => r.valor.toFixed(2).replace(".", ",") },
      { key: "origem", label: "Origem", value: (r) => r.origem },
    ]);
  };

  const printStatement = () => {
    printReport(
      "Extrato de Contas",
      range,
      [
        { label: "Saldo total", value: formatBRL(totals.balance) },
        { label: "Entradas", value: formatBRL(periodTotals.income) },
        { label: "Saídas", value: formatBRL(periodTotals.expense) },
        { label: "Resultado", value: formatBRL(periodTotals.net) },
      ],
      {
        columns: [
          { label: "Data e hora" },
          { label: "Conta" },
          { label: "Descrição" },
          { label: "Categoria" },
          { label: "Status" },
          { label: "Valor", numeric: true },
        ],
        rows: statementRows.map((r) => [
          formatTransactionDateTime(r.date, r.time, r.createdAt),
          r.contaNome,
          r.description,
          r.category ?? "Sem categoria",
          r.statusLabel,
          formatBRL(r.valorAssinado),
        ]),
      },
    );
  };

  /* --------------------------------------------------------- colunas */
  const columns: Array<ReportColumn<StatementRow>> = [
    { key: "date", label: "Data e hora", render: (r) => formatTransactionDateTime(r.date, r.time, r.createdAt) },
    { key: "contaNome", label: "Conta" },
    {
      key: "description",
      label: "Descrição",
      render: (r) => (
        <div className="flex flex-col">
          <span>{r.description}</span>
          {isTransferTx(r) && (
            <span className="text-xs text-muted-foreground">Transferência interna</span>
          )}
        </div>
      ),
    },
    { key: "category", label: "Categoria", render: (r) => r.category ?? "Sem categoria" },
    {
      key: "statusLabel",
      label: "Status",
      render: (r) => (
        <Badge variant={r.statusLabel === "Conciliado" ? "secondary" : "outline"}>{r.statusLabel}</Badge>
      ),
    },
    {
      key: "valorAssinado",
      label: "Valor",
      numeric: true,
      render: (r) => (
        <span className={r.valorAssinado < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
          {formatBRL(r.valorAssinado)}
        </span>
      ),
    },
    {
      key: "runningBalance",
      label: "Saldo",
      numeric: true,
      render: (r) => <span className="tabular-nums">{formatBRL(r.runningBalance)}</span>,
    },
    {
      key: "origem",
      label: "Ações",
      sortable: false,
      render: (r) => (
        <div className="flex justify-end gap-1">
          {r.receiptUrl && (
            <Button variant="outline" size="sm" disabled={receiptLoadingId === r.id} onClick={() => void openC6Receipt(r)}>
              <ReceiptText className="mr-1 h-4 w-4" />
              {receiptLoadingId === r.id ? "Abrindo..." : "Comprovante"}
            </Button>
          )}
          {r.category === "Extrato C6" && !r.referenceId && (
            <Button variant="outline" size="sm" onClick={() => setLinkTransaction(r)}>
              <Link2 className="mr-1 h-4 w-4" /> Vincular
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Alternar conciliação"
            onClick={() => toggleReconciled(r)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Estornar lançamento"
            onClick={() => setReversalTarget(r)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  /* ------------------------------------------------------------ render */
  return (
    <div className="space-y-4">
      <SectionState
        isLoading={data.loading}
        isError={!!data.error}
        denied={data.denied}
        onRetry={data.refresh}
      >
        {data.ledgerExtrasPending && (
          <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Conciliação manual e fechamento por período ficam disponíveis após aprovar a migração
              de banco apresentada no relatório (tabelas <code>bank_transaction_reconciliations</code> e{" "}
              <code>bank_account_closings</code>). Todo o restante do painel já está ativo.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Saldo total (contas ativas)" value={formatBRL(totals.balance)} />
          <KpiCard label="Disponível hoje" value={formatBRL(totals.available)} hint="Exclui lançamentos futuros" />
          <KpiCard
            label="Entradas no período"
            value={formatBRL(periodTotals.income)}
            tone="positive"
            hint="Sem transferências internas"
          />
          <KpiCard
            label="Saídas no período"
            value={formatBRL(periodTotals.expense)}
            tone="negative"
            hint="Sem transferências internas"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="visao">Visão por conta</TabsTrigger>
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            <TabsTrigger value="transferencias">Transferências</TabsTrigger>
            <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------ visão por conta */}
          <TabsContent value="visao" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                <Label htmlFor="show-inactive" className="text-sm">Mostrar contas inativas</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setTransferOpen(true)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferir
                </Button>
                <Button
                  onClick={() => {
                    setAccountForm(emptyAccountForm);
                    setAccountOpen(true);
                  }}
                >
                  Nova conta
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" aria-label="Mais ações de contas">
                      <MoreHorizontal className="mr-2 h-4 w-4" /> Mais
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setClosingOpen(true)}>
                      <Lock className="mr-2 h-4 w-4" /> Fechar período
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={recalculating || busy}
                      onSelect={(e) => {
                        e.preventDefault();
                        void recalculateBalances();
                      }}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
                      {recalculating ? "Sincronizando saldos..." : "Sincronizar saldos"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setOpenFinanceOpen(true)}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Conexão automática (Open Finance)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

            </div>

            {totals.divergence > 0.009 && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                Divergência total entre saldo calculado e saldo armazenado:{" "}
                <strong>{formatBRL(totals.divergence)}</strong>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleAccounts.map((account) => {
                const s = summaries.get(account.id)!;
                const closed = closedThroughFor(data.closings, account.id);
                return (
                  <Card key={account.id} className={account.isActive ? "" : "opacity-70"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{account.name}</CardTitle>
                          <CardDescription>
                            {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
                            {account.bankName ? ` · ${account.bankName}` : ""}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          {!account.isActive && <Badge variant="outline">Inativa</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${account.name}`}
                            onClick={() => {
                              setAccountForm({
                                id: account.id,
                                name: account.name,
                                type: account.type,
                                bankName: account.bankName ?? "",
                                agency: account.agency ?? "",
                                accountNumber: account.accountNumber ?? "",
                                initialBalance: account.initialBalance,
                                isActive: account.isActive,
                              });
                              setAccountOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p className="text-2xl font-bold tabular-nums">{formatBRL(s.current)}</p>
                      <div className="grid grid-cols-2 gap-x-3 text-muted-foreground">
                        <span>Saldo inicial</span>
                        <span className="text-right tabular-nums">{formatBRL(s.initial)}</span>
                        <span>Entradas</span>
                        <span className="text-right tabular-nums">{formatBRL(s.income)}</span>
                        <span>Saídas</span>
                        <span className="text-right tabular-nums">{formatBRL(s.expense)}</span>
                        <span>Transferências</span>
                        <span className="text-right tabular-nums">
                          +{formatBRL(s.transferIn)} / -{formatBRL(s.transferOut)}
                        </span>
                        <span>Disponível hoje</span>
                        <span className="text-right tabular-nums">{formatBRL(s.available)}</span>
                        {Math.abs(s.scheduled) > 0.009 && (
                          <>
                            <span>Previsto (futuro)</span>
                            <span className="text-right tabular-nums">{formatBRL(s.scheduled)}</span>
                          </>
                        )}
                        <span>Saldo armazenado</span>
                        <span className="text-right tabular-nums">{formatBRL(s.stored)}</span>
                      </div>
                      {Math.abs(s.divergence) > 0.009 && (
                        <p className="pt-1 text-xs text-destructive">
                          Divergência de {formatBRL(s.divergence)} (o saldo armazenado ignora o saldo inicial).
                        </p>
                      )}
                      {closed && (
                        <p className="pt-1 text-xs text-muted-foreground">
                          Período fechado até {formatDateBR(closed)}
                        </p>
                      )}
                      <Separator className="my-2" />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`view-statement-${account.id}`}
                          onClick={() => {
                            setAccountFilter(account.id);
                            setActiveTab("extrato");
                          }}
                        >
                          Ver extrato
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`sync-statement-${account.id}`}
                                aria-label={`Sincronizar extrato de ${account.name}`}
                                disabled={syncing || busy}
                                onClick={() => setSyncAccount(account)}
                              >
                                <FileUp className="mr-1 h-4 w-4" aria-hidden="true" />
                                Sincronizar extrato
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Importar OFX, CSV, XLSX ou XLS desta conta com prévia e conciliação antes de gravar.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Mais ações de ${account.name}`}
                            >
                              <MoreHorizontal className="mr-1 h-4 w-4" aria-hidden="true" /> Mais
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setAccountForm({
                                  id: account.id,
                                  name: account.name,
                                  type: account.type,
                                  bankName: account.bankName ?? "",
                                  agency: account.agency ?? "",
                                  accountNumber: account.accountNumber ?? "",
                                  initialBalance: account.initialBalance,
                                  isActive: account.isActive,
                                });
                                setAccountOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar conta
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                account.isActive
                                  ? setInactivateTarget(account)
                                  : void toggleAccountActive(account, true)
                              }
                            >
                              {account.isActive ? "Inativar conta" : "Reativar conta"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                      </div>
                      {!canDeleteAccount(account.id, data.transactions) && (
                        <p className="text-xs text-muted-foreground">
                          Conta com histórico: exclusão não permitida, apenas inativação.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {visibleAccounts.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
            )}
          </TabsContent>

          {/* ------------------------------------------------------- extrato */}
          <TabsContent value="extrato" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div>
                  <Label htmlFor="f-periodo">Período</Label>
                  <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
                    <SelectTrigger id="f-periodo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="mes">Mês atual</SelectItem>
                      <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                      <SelectItem value="trimestre">Trimestre</SelectItem>
                      <SelectItem value="ano">Ano</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {preset === "custom" && (
                  <>
                    <div>
                      <Label htmlFor="f-inicio">Início</Label>
                      <Input
                        id="f-inicio"
                        type="date"
                        value={custom.start}
                        onChange={(e) => setCustom({ ...custom, start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="f-fim">Fim</Label>
                      <Input
                        id="f-fim"
                        type="date"
                        value={custom.end}
                        onChange={(e) => setCustom({ ...custom, end: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="f-conta">Conta</Label>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger id="f-conta"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {data.accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="f-tipo">Tipo</Label>
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TxType | "all")}>
                    <SelectTrigger id="f-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Entradas</SelectItem>
                      <SelectItem value="expense">Saídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="f-status">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TxStatus | "all")}>
                    <SelectTrigger id="f-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="conciliado">Conciliados</SelectItem>
                      <SelectItem value="pendente">Pendentes</SelectItem>
                      <SelectItem value="futuro">Futuros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="f-categoria">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger id="f-categoria"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <ReportTable
              title="Extrato"
              rows={statementRows}
              columns={columns}
              searchFields={["description", "contaNome", "category", "origem"]}
              initialSort={{ field: "date", direction: "desc" }}
              pageSize={25}
              emptyMessage="Nenhum lançamento no período/filtros selecionados."
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={printStatement}>
                    <Printer className="mr-2 h-4 w-4" /> Imprimir
                  </Button>
                </>
              }
            />
          </TabsContent>

          {/* ------------------------------------------------ transferências */}
          <TabsContent value="transferencias" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Nova transferência
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transferências do período ({periodTotals.transfers.length})</CardTitle>
                <CardDescription>
                  Pares rastreados por origem — não entram como receita nem despesa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {periodTotals.transfers.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma transferência no período.
                  </p>
                )}
                {periodTotals.transfers.map((t) => (
                  <div
                    key={t.groupId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {accountName(t.out?.accountId ?? null)} → {accountName(t.in?.accountId ?? null)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateBR(t.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.incomplete && <Badge variant="destructive">Par incompleto</Badge>}
                      <span className="font-semibold tabular-nums">{formatBRL(t.amount)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------------------------------------------- cartões */}
          <TabsContent value="cartoes" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setCardForm(emptyCardForm);
                  setCardOpen(true);
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" /> Novo cartão
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.cards.map((card) => {
                const usage = summarizeCard(card, data.cardTransactions);
                return (
                  <Card key={card.id} className={card.isActive ? "" : "opacity-70"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{card.name}</CardTitle>
                          <CardDescription>
                            {card.cardNumber} · {card.cardType === "credit" ? "Crédito" : "Débito"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          {!card.isActive && <Badge variant="outline">Inativo</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${card.name}`}
                            onClick={() => {
                              setCardForm({
                                id: card.id,
                                name: card.name,
                                cardNumber: card.cardNumber,
                                cardType: card.cardType,
                                bank: card.bank,
                                limitAmount: card.limitAmount ?? 0,
                                isActive: card.isActive,
                              });
                              setCardOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      <div className="grid grid-cols-2 gap-x-3">
                        <span>Gastos</span>
                        <span className="text-right tabular-nums">{formatBRL(usage.spent)}</span>
                        <span>Pagamentos</span>
                        <span className="text-right tabular-nums">{formatBRL(usage.paid)}</span>
                        <span>Fatura atual</span>
                        <span className="text-right tabular-nums text-foreground">{formatBRL(usage.balance)}</span>
                        {usage.available != null && (
                          <>
                            <span>Limite disponível</span>
                            <span className="text-right tabular-nums">{formatBRL(usage.available)}</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {data.cards.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <BankTransactionLinkDialog
          transaction={linkTransaction}
          open={Boolean(linkTransaction)}
          onOpenChange={(open) => { if (!open) setLinkTransaction(null); }}
          onLinked={() => data.refresh({ silent: true })}
        />
      </SectionState>

      {/* --------------------------------------------------- dialog conta */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{accountForm.id ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>O saldo inicial é usado no cálculo do saldo reconciliado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="acc-name">Nome *</Label>
              <Input
                id="acc-name"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                maxLength={80}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="acc-type">Tipo *</Label>
                <Select
                  value={accountForm.type}
                  onValueChange={(v) => setAccountForm({ ...accountForm, type: v as AccountRecord["type"] })}
                >
                  <SelectTrigger id="acc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="cash">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="acc-bank">Banco</Label>
                <Input
                  id="acc-bank"
                  value={accountForm.bankName}
                  onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="acc-agency">Agência</Label>
                <Input
                  id="acc-agency"
                  value={accountForm.agency}
                  onChange={(e) => setAccountForm({ ...accountForm, agency: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="acc-number">Conta</Label>
                <Input
                  id="acc-number"
                  value={accountForm.accountNumber}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="acc-initial">Saldo inicial</Label>
              <CurrencyInput
                id="acc-initial"
                value={accountForm.initialBalance}
                onChange={(v) => setAccountForm({ ...accountForm, initialBalance: v })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="acc-active"
                checked={accountForm.isActive}
                onCheckedChange={(v) => setAccountForm({ ...accountForm, isActive: v })}
              />
              <Label htmlFor="acc-active">Conta ativa</Label>
            </div>
            {accountCheck.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive" role="alert">
                {accountCheck.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>Cancelar</Button>
            <Button onClick={saveAccount} disabled={!accountCheck.ok || busy}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- dialog cartão */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cardForm.id ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="card-name">Nome *</Label>
              <Input
                id="card-name"
                value={cardForm.name}
                onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="card-number">Últimos 4 dígitos *</Label>
                <Input
                  id="card-number"
                  inputMode="numeric"
                  value={cardForm.cardNumber}
                  onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                  maxLength={8}
                />
              </div>
              <div>
                <Label htmlFor="card-type">Tipo</Label>
                <Select
                  value={cardForm.cardType}
                  onValueChange={(v) => setCardForm({ ...cardForm, cardType: v as "credit" | "debit" })}
                >
                  <SelectTrigger id="card-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="card-bank">Banco</Label>
                <Input
                  id="card-bank"
                  value={cardForm.bank}
                  onChange={(e) => setCardForm({ ...cardForm, bank: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="card-limit">Limite</Label>
                <CurrencyInput
                  id="card-limit"
                  value={cardForm.limitAmount}
                  onChange={(v) => setCardForm({ ...cardForm, limitAmount: v })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="card-active"
                checked={cardForm.isActive}
                onCheckedChange={(v) => setCardForm({ ...cardForm, isActive: v })}
              />
              <Label htmlFor="card-active">Cartão ativo</Label>
            </div>
            {cardCheck.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive" role="alert">
                {cardCheck.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardOpen(false)}>Cancelar</Button>
            <Button onClick={saveCard} disabled={!cardCheck.ok || busy}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------- dialog transferência */}
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setTransferStep("form");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transferStep === "form" ? "Transferência entre contas" : "Confirmar transferência"}
            </DialogTitle>
            <DialogDescription>
              Gera duas pernas vinculadas; não afeta receitas nem despesas.
            </DialogDescription>
          </DialogHeader>

          {transferStep === "form" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="tr-from">Conta de origem *</Label>
                <Select
                  value={transfer.fromAccountId}
                  onValueChange={(v) => setTransfer({ ...transfer, fromAccountId: v })}
                >
                  <SelectTrigger id="tr-from"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {data.accounts.filter((a) => a.isActive).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {formatBRL(summaries.get(a.id)?.current ?? 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tr-to">Conta de destino *</Label>
                <Select
                  value={transfer.toAccountId}
                  onValueChange={(v) => setTransfer({ ...transfer, toAccountId: v })}
                >
                  <SelectTrigger id="tr-to"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {data.accounts.filter((a) => a.isActive).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {formatBRL(summaries.get(a.id)?.current ?? 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tr-amount">Valor *</Label>
                  <CurrencyInput
                    id="tr-amount"
                    value={transfer.amount}
                    onChange={(v) => setTransfer({ ...transfer, amount: v })}
                  />
                </div>
                <div>
                  <Label htmlFor="tr-date">Data *</Label>
                  <Input
                    id="tr-date"
                    type="date"
                    value={transfer.date}
                    onChange={(e) => setTransfer({ ...transfer, date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tr-desc">Descrição</Label>
                <Input
                  id="tr-desc"
                  value={transfer.description}
                  onChange={(e) => setTransfer({ ...transfer, description: e.target.value })}
                  maxLength={140}
                />
              </div>
              {transferCheck.errors.length > 0 && (
                <ul className="space-y-1 text-sm text-destructive" role="alert">
                  {transferCheck.errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
              {transferCheck.warnings.map((w) => (
                <p key={w} className="text-sm text-amber-600 dark:text-amber-400">{w}</p>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border p-3">
                <p className="flex justify-between"><span>Origem</span><strong>{accountName(transfer.fromAccountId)}</strong></p>
                <p className="flex justify-between"><span>Destino</span><strong>{accountName(transfer.toAccountId)}</strong></p>
                <p className="flex justify-between"><span>Valor</span><strong>{formatBRL(transfer.amount)}</strong></p>
                <p className="flex justify-between"><span>Data</span><strong>{formatDateBR(transfer.date)}</strong></p>
              </div>
              {transferCheck.warnings.map((w) => (
                <p key={w} className="text-amber-600 dark:text-amber-400">{w}</p>
              ))}
            </div>
          )}

          <DialogFooter>
            {transferStep === "form" ? (
              <>
                <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                <Button disabled={!transferCheck.ok} onClick={() => setTransferStep("confirm")}>
                  Revisar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setTransferStep("form")}>Voltar</Button>
                <Button onClick={submitTransfer} disabled={busy}>Confirmar transferência</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------- dialog fechamento */}
      <Dialog open={closingOpen} onOpenChange={setClosingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar período</DialogTitle>
            <DialogDescription>
              Bloqueia novos lançamentos e estornos com data anterior ou igual à data escolhida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cl-account">Conta *</Label>
              <Select
                value={closingForm.accountId}
                onValueChange={(v) => setClosingForm({ ...closingForm, accountId: v })}
              >
                <SelectTrigger id="cl-account"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cl-date">Fechar até *</Label>
              <Input
                id="cl-date"
                type="date"
                value={closingForm.closedThrough}
                onChange={(e) => setClosingForm({ ...closingForm, closedThrough: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cl-notes">Observações</Label>
              <Textarea
                id="cl-notes"
                value={closingForm.notes}
                onChange={(e) => setClosingForm({ ...closingForm, notes: e.target.value })}
              />
            </div>
            {closingCheck.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive" role="alert">
                {closingCheck.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingOpen(false)}>Cancelar</Button>
            <Button onClick={submitClosing} disabled={!closingCheck.ok || !closingForm.accountId || busy}>
              Fechar período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- alerta estorno */}
      <AlertDialog open={!!reversalTarget} onOpenChange={(o) => !o && setReversalTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento original é preservado e uma contrapartida de{" "}
              {reversalTarget ? formatBRL(reversalTarget.amount) : ""} será criada em {today}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rev-reason">Motivo</Label>
            <Textarea
              id="rev-reason"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Descreva o motivo do estorno"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReversal}>Confirmar estorno</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------------------------------------------- alerta inativação */}
      <AlertDialog open={!!inactivateTarget} onOpenChange={(o) => !o && setInactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar {inactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta deixa de aparecer em novos lançamentos, mas todo o histórico financeiro é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inactivateTarget && toggleAccountActive(inactivateTarget, false)}
            >
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -------------------------------- sincronização de extrato por conta */}
      {syncAccount && (
        <BankStatementSync
          key={syncAccount.id}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setSyncAccount(null);
              setSyncing(false);
            }
          }}
          account={{
            id: syncAccount.id,
            name: syncAccount.name,
            balance: summaries.get(syncAccount.id)?.current ?? 0,
            type: syncAccount.type,
          }}
          onSyncComplete={async () => {
            setSyncing(true);
            await data.refresh();
            setSyncing(false);
          }}
          onDataRefresh={async () => {
            await data.refresh();
          }}
        />
      )}

      {/* ------------------------------ Open Finance (informativo, bloqueado) */}
      <Dialog open={openFinanceOpen} onOpenChange={setOpenFinanceOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conexão automática (Open Finance)</DialogTitle>
            <DialogDescription>
              Requer provedor autorizado e consentimento. Nenhuma credencial fica no navegador.
            </DialogDescription>
          </DialogHeader>
          <BankRealTimeSync />
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default AccountsPanel;
