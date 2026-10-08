/**
 * RELATÓRIOS da Gestão Financeira.
 * Reaproveita o núcleo de relatórios (src/lib/reports.ts), a exportação
 * (src/lib/reportExport.ts) e as primitivas de UI (ReportPrimitives).
 * Não duplica a Central de Relatórios: aqui o foco é conciliação financeira.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, RefreshCw } from "lucide-react";

import {
  BreakdownList,
  KpiCard,
  ReportTable,
  SectionState,
  type ReportColumn,
} from "@/components/reports/ReportPrimitives";
import {
  compare,
  csvNumber,
  formatBRL,
  formatDateBR,
  groupTotals,
  previousPeriod,
  resolvePeriod,
  todaySaoPaulo,
  type DateRange,
  type PeriodPreset,
} from "@/lib/reports";
import { downloadReportCsv, printReport } from "@/lib/reportExport";
import { formatTransactionDateTime } from "@/lib/transactionDateTime";
import { useFinanceReportsData } from "@/hooks/useFinanceReportsData";
import {
  buildAging,
  buildCommitments,
  buildDelinquency,
  buildEventResults,
  buildManagerialDre,
  buildReconciliation,
  cashFlowByMonth,
  filterLedger,
  dedupeLedger,
  summarizeAging,
  summarizeLedger,
  type LedgerEntry,
} from "@/lib/financeReports";

const PERIODS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "mes", label: "Mês atual" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "custom", label: "Personalizado" },
];

const SOURCE_LABEL: Record<string, string> = {
  bank_transactions: "Banco",
  event_expenses: "Despesa de evento",
  company_expenses: "Despesa da empresa",
  bank_card_transactions: "Cartão",
  events: "Evento",
  finance_payments: "Pagamento",
};

export const FinancialReportsPanel = () => {
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [custom, setCustom] = useState<DateRange>({
    start: todaySaoPaulo().slice(0, 8) + "01",
    end: todaySaoPaulo(),
  });
  const [accountId, setAccountId] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [drill, setDrill] = useState<LedgerEntry | null>(null);

  const range = useMemo(() => resolvePeriod(preset, custom), [preset, custom]);
  const prevRange = useMemo(() => previousPeriod(range), [range]);

  const { accounts, events, ledger, finance } = useFinanceReportsData(range);
  const prev = useFinanceReportsData(prevRange);

  const allEntries = useMemo(
    () => dedupeLedger(ledger.data?.entries ?? []),
    [ledger.data],
  );
  const prevEntries = useMemo(
    () => dedupeLedger(prev.ledger.data?.entries ?? []),
    [prev.ledger.data],
  );

  const entries = useMemo(
    () =>
      filterLedger(allEntries, {
        range,
        accountId,
        category: categoryFilter,
        type: typeFilter,
        eventId: eventFilter,
      }),
    [allEntries, range, accountId, categoryFilter, typeFilter, eventFilter],
  );

  const totals = useMemo(() => summarizeLedger(entries), [entries]);
  const prevTotals = useMemo(
    () => summarizeLedger(filterLedger(prevEntries, { range: prevRange })),
    [prevEntries, prevRange],
  );

  const saldoContas = useMemo(
    () => (accounts.data?.rows ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0),
    [accounts.data],
  );

  const dre = useMemo(() => buildManagerialDre(entries), [entries]);
  const cashFlow = useMemo(() => cashFlowByMonth(entries, range, 0), [entries, range]);

  const aging = useMemo(
    () =>
      buildAging(
        finance.data?.titles ?? [],
        finance.data?.installments ?? [],
        finance.data?.payments ?? [],
      ),
    [finance.data],
  );
  const agingReceber = useMemo(() => aging.filter((r) => r.kind === "receber"), [aging]);
  const agingPagar = useMemo(() => aging.filter((r) => r.kind === "pagar"), [aging]);
  const resumoReceber = useMemo(() => summarizeAging(agingReceber), [agingReceber]);
  const resumoPagar = useMemo(() => summarizeAging(agingPagar), [agingPagar]);
  const inadimplencia = useMemo(
    () => buildDelinquency(aging, totals.entradas),
    [aging, totals.entradas],
  );
  const commitments = useMemo(() => buildCommitments(aging, saldoContas), [aging, saldoContas]);

  const eventResults = useMemo(
    () => buildEventResults(events.data?.rows ?? [], entries),
    [events.data, entries],
  );

  const reconciliation = useMemo(() => buildReconciliation(entries), [entries]);

  const categorias = useMemo(
    () =>
      groupTotals(
        entries.filter((e) => e.type === "expense"),
        (e) => e.category,
        (e) => e.amount,
      ),
    [entries],
  );
  const receitasPorCategoria = useMemo(
    () =>
      groupTotals(
        entries.filter((e) => e.type === "income"),
        (e) => e.category,
        (e) => e.amount,
      ),
    [entries],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set(allEntries.map((e) => e.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allEntries]);

  const isLoading = ledger.isLoading || finance.isLoading;
  const isError = ledger.isError || finance.isError;
  const denied = Boolean(ledger.data?.denied && finance.data?.denied);

  const refetchAll = () => {
    void ledger.refetch();
    void finance.refetch();
    void accounts.refetch();
    void events.refetch();
  };

  /* ------------------------------------------------------------- colunas */

  const ledgerColumns: Array<ReportColumn<LedgerEntry>> = [
    { key: "date", label: "Data e hora", render: (r) => formatTransactionDateTime(r.date, r.time, r.createdAt) },
    { key: "description", label: "Descrição" },
    { key: "category", label: "Categoria" },
    { key: "accountName", label: "Conta", render: (r) => r.accountName ?? "—" },
    {
      key: "source",
      label: "Origem",
      render: (r) => <Badge variant="outline">{SOURCE_LABEL[r.source] ?? r.source}</Badge>,
    },
    {
      key: "amount",
      label: "Valor",
      numeric: true,
      render: (r) => (
        <span className={r.type === "income" ? "text-emerald-600" : "text-destructive"}>
          {r.type === "income" ? "" : "-"}
          {formatBRL(r.amount)}
        </span>
      ),
    },
  ];

  const exportLedger = () =>
    downloadReportCsv("livro-caixa-financeiro", range, entries, [
      { key: "date", label: "Data e hora", value: (r) => formatTransactionDateTime(r.date, r.time, r.createdAt) },
      { key: "description", label: "Descrição", value: (r) => r.description },
      { key: "category", label: "Categoria", value: (r) => r.category },
      { key: "account", label: "Conta", value: (r) => r.accountName ?? "" },
      { key: "type", label: "Tipo", value: (r) => (r.type === "income" ? "Entrada" : "Saída") },
      { key: "origin", label: "Origem", value: (r) => SOURCE_LABEL[r.source] ?? r.source },
      { key: "sourceId", label: "ID de origem", value: (r) => r.sourceId },
      {
        key: "amount",
        label: "Valor",
        value: (r) => csvNumber(r.type === "income" ? r.amount : -r.amount),
      },
    ]);

  const printLedger = () =>
    printReport(
      "Livro-caixa financeiro",
      range,
      [
        { label: "Entradas", value: formatBRL(totals.entradas) },
        { label: "Saídas", value: formatBRL(totals.saidas) },
        { label: "Saldo", value: formatBRL(totals.saldo) },
        { label: "Resultado (DRE)", value: formatBRL(dre.resultado) },
      ],
      {
        columns: [
          { label: "Data" },
          { label: "Descrição" },
          { label: "Categoria" },
          { label: "Conta" },
          { label: "Valor", numeric: true },
        ],
        rows: entries.map((r) => [
          formatTransactionDateTime(r.date, r.time, r.createdAt),
          r.description,
          r.category,
          r.accountName ?? "—",
          `${r.type === "income" ? "" : "-"}${formatBRL(r.amount)}`,
        ]),
      },
    );

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relatórios financeiros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <Label htmlFor="fin-rep-period">Período</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
              <SelectTrigger id="fin-rep-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="fin-rep-start">Início</Label>
                <Input
                  id="fin-rep-start"
                  type="date"
                  value={custom.start}
                  onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fin-rep-end">Fim</Label>
                <Input
                  id="fin-rep-end"
                  type="date"
                  value={custom.end}
                  onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="fin-rep-account">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="fin-rep-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(accounts.data?.rows ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fin-rep-type">Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger id="fin-rep-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Entradas</SelectItem>
                <SelectItem value="expense">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fin-rep-category">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="fin-rep-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fin-rep-event">Evento</Label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger id="fin-rep-event">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos</SelectItem>
                {(events.data?.rows ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 lg:col-span-6">
            <Button variant="outline" size="sm" onClick={refetchAll}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportLedger}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printLedger}>
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionState
        isLoading={isLoading}
        isError={isError}
        denied={denied}
        onRetry={refetchAll}
        isEmpty={entries.length === 0 && aging.length === 0}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Entradas (realizado)"
            value={formatBRL(totals.entradas)}
            comparison={compare(totals.entradas, prevTotals.entradas)}
            tone="positive"
          />
          <KpiCard
            label="Saídas (realizado)"
            value={formatBRL(totals.saidas)}
            comparison={compare(totals.saidas, prevTotals.saidas)}
            tone="negative"
          />
          <KpiCard
            label="Saldo do período"
            value={formatBRL(totals.saldo)}
            comparison={compare(totals.saldo, prevTotals.saldo)}
            tone={totals.saldo >= 0 ? "positive" : "negative"}
            hint={`Transferências excluídas: ${formatBRL(totals.transferencias)}`}
          />
          <KpiCard
            label="Saldo em contas"
            value={formatBRL(saldoContas)}
            hint={`Projetado: ${formatBRL(commitments.saldoProjetado)}`}
          />
          <KpiCard
            label="A receber em aberto"
            value={formatBRL(commitments.previstoReceber)}
            hint={`Vencido: ${formatBRL(commitments.vencidoReceber)}`}
          />
          <KpiCard
            label="Comprometido (a pagar)"
            value={formatBRL(commitments.comprometido)}
            hint={`Vencido: ${formatBRL(commitments.vencidoPagar)}`}
            tone="negative"
          />
          <KpiCard
            label="Inadimplência"
            value={`${inadimplencia.indice.toString().replace(".", ",")}%`}
            hint={`Vencido: ${formatBRL(inadimplencia.vencido)}`}
          />
          <KpiCard
            label="Resultado gerencial"
            value={formatBRL(dre.resultado)}
            tone={dre.resultado >= 0 ? "positive" : "negative"}
            hint={`Margem líquida: ${dre.margemLiquida.toString().replace(".", ",")}%`}
          />
        </div>

        <Tabs defaultValue="dre" className="mt-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="dre">DRE gerencial</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
            <TabsTrigger value="aging">Aging & inadimplência</TabsTrigger>
            <TabsTrigger value="eventos">Resultado por evento</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
            <TabsTrigger value="livro">Livro-caixa</TabsTrigger>
          </TabsList>

          {/* --------------------------------------------------------- DRE */}
          <TabsContent value="dre" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  DRE gerencial simplificada (regime de caixa)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {[
                  ["Receita bruta", dre.receitaBruta, false],
                  ["(-) Impostos e deduções", -dre.impostos, false],
                  ["= Receita líquida", dre.receitaLiquida, true],
                  ["(-) Custos diretos", -dre.custoDireto, false],
                  ["= Lucro bruto", dre.lucroBruto, true],
                  ["(-) Administrativas", -dre.despesasAdministrativas, false],
                  ["(-) Comerciais", -dre.despesasComerciais, false],
                  ["(-) Financeiras", -dre.despesasFinanceiras, false],
                  ["(-) Outras", -dre.outrasDespesas, false],
                  ["= Resultado do período", dre.resultado, true],
                ].map(([label, value, strong]) => (
                  <div
                    key={String(label)}
                    className={`flex items-baseline justify-between gap-4 border-b py-1.5 ${
                      strong ? "font-semibold" : ""
                    }`}
                  >
                    <span>{label as string}</span>
                    <span
                      className={`tabular-nums ${
                        (value as number) < 0 ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {formatBRL(value as number)}
                    </span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-4 pt-3 text-xs text-muted-foreground">
                  <span>Margem bruta: {dre.margemBruta.toString().replace(".", ",")}%</span>
                  <span>Margem líquida: {dre.margemLiquida.toString().replace(".", ",")}%</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <BreakdownList
                title="Despesas por categoria / centro de custo"
                items={categorias}
                format={formatBRL}
              />
              <BreakdownList
                title="Receitas por categoria"
                items={receitasPorCategoria}
                format={formatBRL}
              />
            </div>
          </TabsContent>

          {/* -------------------------------------------------- fluxo caixa */}
          <TabsContent value="fluxo">
            <ReportTable
              title="Fluxo de caixa por mês"
              rows={cashFlow.map((p) => ({ ...p, id: p.key }))}
              columns={[
                { key: "label", label: "Mês" },
                {
                  key: "entradas",
                  label: "Entradas",
                  numeric: true,
                  render: (r) => formatBRL(r.entradas),
                },
                {
                  key: "saidas",
                  label: "Saídas",
                  numeric: true,
                  render: (r) => formatBRL(r.saidas),
                },
                {
                  key: "saldo",
                  label: "Saldo",
                  numeric: true,
                  render: (r) => (
                    <span className={r.saldo < 0 ? "text-destructive" : "text-emerald-600"}>
                      {formatBRL(r.saldo)}
                    </span>
                  ),
                },
                {
                  key: "acumulado",
                  label: "Acumulado",
                  numeric: true,
                  render: (r) => formatBRL(r.acumulado),
                },
              ]}
              searchFields={["label"]}
              initialSort={{ field: "key", direction: "asc" }}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadReportCsv(
                      "fluxo-de-caixa",
                      range,
                      cashFlow,
                      [
                        { key: "mes", label: "Mês", value: (r) => r.label },
                        { key: "entradas", label: "Entradas", value: (r) => csvNumber(r.entradas) },
                        { key: "saidas", label: "Saídas", value: (r) => csvNumber(r.saidas) },
                        { key: "saldo", label: "Saldo", value: (r) => csvNumber(r.saldo) },
                        {
                          key: "acumulado",
                          label: "Acumulado",
                          value: (r) => csvNumber(r.acumulado),
                        },
                      ],
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
                </Button>
              }
            />
          </TabsContent>

          {/* -------------------------------------------------------- aging */}
          <TabsContent value="aging" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <BreakdownList
                title={`Aging a receber — ${formatBRL(resumoReceber.total)}`}
                items={resumoReceber.buckets.map((b) => ({
                  key: b.faixa,
                  label: b.faixa,
                  total: b.total,
                  count: b.count,
                }))}
                format={formatBRL}
              />
              <BreakdownList
                title={`Aging a pagar — ${formatBRL(resumoPagar.total)}`}
                items={resumoPagar.buckets.map((b) => ({
                  key: b.faixa,
                  label: b.faixa,
                  total: b.total,
                  count: b.count,
                }))}
                format={formatBRL}
              />
            </div>

            <ReportTable
              title="Títulos em aberto"
              rows={aging}
              columns={[
                { key: "descricao", label: "Descrição" },
                { key: "parte", label: "Cliente / fornecedor" },
                {
                  key: "kind",
                  label: "Tipo",
                  render: (r) => (
                    <Badge variant={r.kind === "receber" ? "default" : "secondary"}>
                      {r.kind === "receber" ? "A receber" : "A pagar"}
                    </Badge>
                  ),
                },
                {
                  key: "vencimento",
                  label: "Vencimento",
                  render: (r) => formatDateBR(r.vencimento),
                },
                { key: "faixa", label: "Faixa" },
                { key: "diasAtraso", label: "Atraso (dias)", numeric: true },
                {
                  key: "valorAberto",
                  label: "Em aberto",
                  numeric: true,
                  render: (r) => formatBRL(r.valorAberto),
                },
              ]}
              searchFields={["descricao", "parte", "faixa"]}
              initialSort={{ field: "diasAtraso", direction: "desc" }}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadReportCsv("aging-titulos", range, aging, [
                      { key: "descricao", label: "Descrição", value: (r) => r.descricao },
                      { key: "parte", label: "Cliente/Fornecedor", value: (r) => r.parte },
                      {
                        key: "kind",
                        label: "Tipo",
                        value: (r) => (r.kind === "receber" ? "A receber" : "A pagar"),
                      },
                      {
                        key: "vencimento",
                        label: "Vencimento",
                        value: (r) => formatDateBR(r.vencimento),
                      },
                      { key: "faixa", label: "Faixa", value: (r) => r.faixa },
                      { key: "atraso", label: "Atraso (dias)", value: (r) => r.diasAtraso },
                      {
                        key: "valorAberto",
                        label: "Em aberto",
                        value: (r) => csvNumber(r.valorAberto),
                      },
                    ])
                  }
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
                </Button>
              }
            />
          </TabsContent>

          {/* ------------------------------------------------------ eventos */}
          <TabsContent value="eventos">
            <ReportTable
              title="Resultado e margem por evento"
              rows={eventResults}
              columns={[
                { key: "evento", label: "Evento" },
                { key: "data", label: "Data", render: (r) => formatDateBR(r.data) },
                { key: "orcado", label: "Orçado", numeric: true, render: (r) => formatBRL(r.orcado) },
                {
                  key: "receita",
                  label: "Receita",
                  numeric: true,
                  render: (r) => formatBRL(r.receita),
                },
                { key: "custo", label: "Custo", numeric: true, render: (r) => formatBRL(r.custo) },
                {
                  key: "margem",
                  label: "Margem",
                  numeric: true,
                  render: (r) => (
                    <span className={r.margem < 0 ? "text-destructive" : "text-emerald-600"}>
                      {formatBRL(r.margem)}
                    </span>
                  ),
                },
                {
                  key: "margemPercentual",
                  label: "Margem %",
                  numeric: true,
                  render: (r) => `${r.margemPercentual.toString().replace(".", ",")}%`,
                },
              ]}
              searchFields={["evento", "status"]}
              initialSort={{ field: "receita", direction: "desc" }}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadReportCsv("resultado-por-evento", range, eventResults, [
                      { key: "evento", label: "Evento", value: (r) => r.evento },
                      { key: "data", label: "Data", value: (r) => formatDateBR(r.data) },
                      { key: "orcado", label: "Orçado", value: (r) => csvNumber(r.orcado) },
                      { key: "receita", label: "Receita", value: (r) => csvNumber(r.receita) },
                      { key: "custo", label: "Custo", value: (r) => csvNumber(r.custo) },
                      { key: "margem", label: "Margem", value: (r) => csvNumber(r.margem) },
                      {
                        key: "margemPercentual",
                        label: "Margem %",
                        value: (r) => csvNumber(r.margemPercentual, 1),
                      },
                    ])
                  }
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
                </Button>
              }
            />
          </TabsContent>

          {/* -------------------------------------------------- conciliação */}
          <TabsContent value="conciliacao">
            <ReportTable
              title="Conciliação por origem (sem comparação por texto)"
              rows={reconciliation}
              columns={[
                { key: "date", label: "Data e hora", render: (r) => formatTransactionDateTime(r.date, r.time, r.createdAt) },
                { key: "description", label: "Descrição" },
                { key: "accountName", label: "Conta", render: (r) => r.accountName ?? "—" },
                {
                  key: "origem",
                  label: "Origem",
                  render: (r) => SOURCE_LABEL[r.origem] ?? r.origem,
                },
                {
                  key: "situacao",
                  label: "Situação",
                  render: (r) => (
                    <Badge
                      variant={
                        r.situacao === "conciliado"
                          ? "default"
                          : r.situacao === "somente_banco"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {r.situacao === "conciliado"
                        ? "Conciliado"
                        : r.situacao === "somente_banco"
                          ? "Somente banco"
                          : "Somente sistema"}
                    </Badge>
                  ),
                },
                {
                  key: "amount",
                  label: "Valor",
                  numeric: true,
                  render: (r) => formatBRL(r.amount),
                },
              ]}
              searchFields={["description", "origem", "situacao"]}
              initialSort={{ field: "date", direction: "desc" }}
            />
          </TabsContent>

          {/* ---------------------------------------------------- livro-caixa */}
          <TabsContent value="livro">
            <ReportTable
              title="Livro-caixa rastreável"
              rows={entries}
              columns={ledgerColumns}
              searchFields={["description", "category", "accountName"]}
              initialSort={{ field: "date", direction: "desc" }}
              onRowSelect={setDrill}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={exportLedger}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={printLedger}>
                    <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Imprimir
                  </Button>
                </>
              }
            />
          </TabsContent>
        </Tabs>
      </SectionState>

      {/* ----------------------------------------------------- drill-down */}
      <Dialog open={Boolean(drill)} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Origem do lançamento</DialogTitle>
          </DialogHeader>
          {drill && (
            <dl className="space-y-2 text-sm">
              {[
                ["Data", formatDateBR(drill.date)],
                ["Descrição", drill.description],
                ["Categoria", drill.category],
                ["Tipo", drill.type === "income" ? "Entrada" : "Saída"],
                ["Valor", formatBRL(drill.amount)],
                ["Conta", drill.accountName ?? "—"],
                ["Tabela de origem", drill.source],
                ["ID de origem", drill.sourceId],
                ["Vínculo", drill.referenceType ? `${drill.referenceType} · ${drill.referenceId}` : "—"],
                ["Evento", drill.eventName ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium break-all">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialReportsPanel;
