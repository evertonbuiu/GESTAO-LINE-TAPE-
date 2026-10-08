import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Download, Printer, RefreshCw } from "lucide-react";
import { useValueVisibility } from "@/hooks/useValueVisibility";
import { useReportsData } from "@/hooks/useReportsData";
import { downloadReportCsv, printReport, type PrintKpi } from "@/lib/reportExport";
import {
  compare,
  csvNumber,
  formatBRL,
  formatDateBR,
  formatPercent,
  groupTotals,
  monthlySeries,
  previousPeriod,
  resolvePeriod,
  sumBy,
  type DateRange,
  type PeriodPreset,
} from "@/lib/reports";
import { BreakdownList, KpiCard, ReportTable, SectionState, type ReportColumn } from "./ReportPrimitives";

interface ReportsCenterProps {
  onNavigate?: (tab: string) => void;
}

interface DrillDown {
  title: string;
  lines: Array<{ label: string; value: string }>;
  targetTab?: string;
  targetLabel?: string;
}

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Mês atual" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "trimestre", label: "Trimestre atual" },
  { value: "ano", label: "Ano atual" },
  { value: "custom", label: "Período personalizado" },
];

const statusTone = (status?: string | null) => {
  const s = (status ?? "").toLowerCase();
  if (["pago", "autorizada", "assinado", "aprovado", "concluido", "concluído"].includes(s)) return "default";
  if (["cancelado", "cancelada", "rejeitado", "erro", "vencido"].includes(s)) return "destructive";
  return "secondary";
};

export const ReportsCenter = ({ onNavigate }: ReportsCenterProps) => {
  const { canViewValues, formatValue } = useValueVisibility();
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [drill, setDrill] = useState<DrillDown | null>(null);

  const range: DateRange = useMemo(
    () => resolvePeriod(preset, { start: customStart, end: customEnd }),
    [preset, customStart, customEnd],
  );
  const prevRange = useMemo(() => previousPeriod(range), [range]);

  const current = useReportsData(range);
  const previous = useReportsData(prevRange);

  const money = (value: number) => formatValue(value);

  const refetchAll = () => {
    Object.values(current).forEach((q) => q.refetch());
    Object.values(previous).forEach((q) => q.refetch());
  };

  /* --------------------------------------------------------------- eventos */
  const events = current.events.data?.rows ?? [];
  const prevEvents = previous.events.data?.rows ?? [];

  const eventOptions = useMemo(
    () => events.map((e) => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (eventFilter !== "all" && e.id !== eventFilter) return false;
        if (statusFilter !== "all" && (e.status ?? "") !== statusFilter) return false;
        return true;
      }),
    [events, eventFilter, statusFilter],
  );

  const eventStatuses = useMemo(
    () => Array.from(new Set(events.map((e) => e.status).filter(Boolean) as string[])).sort(),
    [events],
  );

  const receitaEventos = sumBy(filteredEvents, (e) => e.total_budget);
  const custoEventos = sumBy(filteredEvents, (e) => e.total_expenses);
  const margemEventos = receitaEventos - custoEventos;
  const receitaAnterior = sumBy(prevEvents, (e) => e.total_budget);

  /* -------------------------------------------------------------- despesas */
  const expenses = current.expenses.data?.rows ?? [];
  const prevExpenses = previous.expenses.data?.rows ?? [];

  const expenseCategories = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.category).filter(Boolean) as string[])).sort(),
    [expenses],
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        if (eventFilter !== "all" && e.event_id !== eventFilter) return false;
        if (categoryFilter !== "all" && (e.category ?? "") !== categoryFilter) return false;
        return true;
      }),
    [expenses, eventFilter, categoryFilter],
  );

  const totalDespesas = sumBy(filteredExpenses, (e) => e.total_price);
  const totalDespesasAnterior = sumBy(prevExpenses, (e) => e.total_price);
  const despesasPagas = sumBy(
    filteredExpenses.filter((e) => e.is_paid),
    (e) => e.total_price,
  );

  /* ------------------------------------------------------------ financeiro */
  const titles = current.finance.data?.titles ?? [];
  const payments = current.finance.data?.payments ?? [];
  const paidById = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) =>
      map.set(p.title_id, (map.get(p.title_id) ?? 0) + (p.is_reversal ? -p.amount : p.amount)),
    );
    return map;
  }, [payments]);

  const openTitles = titles.filter(
    (t) => !["cancelado", "estornado", "rascunho"].includes(t.status),
  );
  const aReceber = sumBy(
    openTitles.filter((t) => t.kind === "receber"),
    (t) => Math.max(0, t.total_amount - (paidById.get(t.id) ?? 0)),
  );
  const aPagar = sumBy(
    openTitles.filter((t) => t.kind === "pagar"),
    (t) => Math.max(0, t.total_amount - (paidById.get(t.id) ?? 0)),
  );

  /* -------------------------------------------------------------- comercial */
  const quotes = current.commercial.data?.quotes ?? [];
  const contracts = current.commercial.data?.contracts ?? [];
  const valorOrcado = sumBy(quotes, (q) => q.total_amount);
  const valorContratado = sumBy(contracts, (c) => c.total_value);
  const conversao = quotes.length > 0 ? (contracts.length / quotes.length) * 100 : 0;

  /* ---------------------------------------------------------------- pessoas */
  const dailyRates = current.people.data?.rows ?? [];
  const filteredRates = useMemo(
    () => (eventFilter === "all" ? dailyRates : dailyRates.filter((r) => r.event_id === eventFilter)),
    [dailyRates, eventFilter],
  );
  const custoPessoas = sumBy(
    filteredRates,
    (r) =>
      r.amount +
      (r.overtime_amount ?? 0) +
      (r.food_amount ?? 0) +
      (r.transport_amount ?? 0) -
      (r.discount_amount ?? 0),
  );

  /* ---------------------------------------------------------------- estoque */
  const equipment = current.equipment.data?.rows ?? [];
  const emFalta = equipment.filter((e) => (e.available ?? 0) <= (e.min_stock ?? 0));
  const totalLocado = equipment.reduce((sum, e) => sum + (e.rented ?? 0), 0);
  const ocupacao = useMemo(() => {
    const stock = equipment.reduce((s, e) => s + (e.total_stock ?? 0), 0);
    return stock > 0 ? (totalLocado / stock) * 100 : 0;
  }, [equipment, totalLocado]);

  /* ------------------------------------------------------------------ nfse */
  const invoices = current.invoices.data?.rows ?? [];
  const valorNotas = sumBy(invoices, (i) => i.service_value);
  const issNotas = sumBy(invoices, (i) => i.iss_value);

  /* ---------------------------------------------------------- visão geral */
  const seriesRows = useMemo(
    () => [
      ...filteredEvents.map((e) => ({
        date: e.event_date,
        amount: Number(e.total_budget ?? 0),
        type: "income" as const,
      })),
      ...filteredExpenses.map((e) => ({
        date: e.expense_date,
        amount: Number(e.total_price ?? 0),
        type: "expense" as const,
      })),
    ],
    [filteredEvents, filteredExpenses],
  );
  const series = useMemo(() => monthlySeries(seriesRows, range), [seriesRows, range]);
  const maxSeries = Math.max(1, ...series.map((s) => Math.max(s.entrada, s.saida)));

  const categoryBreakdown = useMemo(
    () => groupTotals(filteredExpenses, (e) => e.category, (e) => e.total_price),
    [filteredExpenses],
  );

  const clearFilters = () => {
    setPreset("mes");
    setCustomStart("");
    setCustomEnd("");
    setEventFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const overviewKpis: PrintKpi[] = [
    { label: "Receita de eventos", value: money(receitaEventos) },
    { label: "Despesas", value: money(totalDespesas) },
    { label: "Margem", value: money(margemEventos) },
    { label: "A receber", value: money(aReceber) },
    { label: "A pagar", value: money(aPagar) },
  ];

  const printOverview = () =>
    printReport("Relatório geral", range, overviewKpis, {
      columns: [{ label: "Mês" }, { label: "Entradas", numeric: true }, { label: "Saídas", numeric: true }, { label: "Saldo", numeric: true }],
      rows: series.map((s) => [s.label, money(s.entrada), money(s.saida), money(s.saldo)]),
    });

  const denyValues = !canViewValues;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              {formatDateBR(range.start)} a {formatDateBR(range.end)} — fuso America/São_Paulo
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refetchAll} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={printOverview} className="gap-2">
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir / PDF
          </Button>
        </div>
      </header>

      {denyValues && (
        <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Seu perfil não exibe valores monetários. Os totais aparecem como “---”.
        </p>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="report-period">Período</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
                <SelectTrigger id="report-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-start">Data inicial</Label>
              <Input
                id="report-start"
                type="date"
                value={preset === "custom" ? customStart : range.start}
                disabled={preset !== "custom"}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-end">Data final</Label>
              <Input
                id="report-end"
                type="date"
                value={preset === "custom" ? customEnd : range.end}
                disabled={preset !== "custom"}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-event">Evento</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger id="report-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {eventOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-status">Status do evento</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="report-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {eventStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-category">Categoria de despesa</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="report-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------- Visão geral */}
        <TabsContent value="geral" className="space-y-4">
          <SectionState
            isLoading={current.events.isLoading || current.expenses.isLoading}
            isError={current.events.isError || current.expenses.isError}
            onRetry={refetchAll}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Receita de eventos"
                value={money(receitaEventos)}
                comparison={compare(receitaEventos, receitaAnterior)}
                tone="positive"
              />
              <KpiCard
                label="Despesas do período"
                value={money(totalDespesas)}
                comparison={compare(totalDespesas, totalDespesasAnterior)}
                tone="negative"
              />
              <KpiCard
                label="Margem (receita - despesas)"
                value={money(margemEventos)}
                hint={`${filteredEvents.length} evento(s) no período`}
              />
              <KpiCard
                label="Saldo previsto (títulos)"
                value={money(aReceber - aPagar)}
                hint={`A receber ${money(aReceber)} · A pagar ${money(aPagar)}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Entradas x saídas por mês</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {series.map((s) => (
                    <div key={s.month}>
                      <div className="flex justify-between text-sm">
                        <span>{s.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {money(s.saldo)}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <div
                          className="h-2 rounded bg-emerald-500"
                          style={{ width: `${(s.entrada / maxSeries) * 100}%` }}
                          role="img"
                          aria-label={`Entradas em ${s.label}: ${money(s.entrada)}`}
                        />
                        <div
                          className="h-2 rounded bg-destructive"
                          style={{ width: `${(s.saida / maxSeries) * 100}%` }}
                          role="img"
                          aria-label={`Saídas em ${s.label}: ${money(s.saida)}`}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <BreakdownList
                title="Despesas por categoria"
                items={categoryBreakdown}
                format={money}
              />
            </div>
          </SectionState>
        </TabsContent>

        {/* --------------------------------------------------- Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <SectionState
            isLoading={current.finance.isLoading}
            isError={current.finance.isError}
            denied={current.finance.data?.denied}
            isEmpty={titles.length === 0}
            emptyMessage="Nenhum título com vencimento no período."
            onRetry={() => current.finance.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="A receber em aberto" value={money(aReceber)} tone="positive" />
              <KpiCard label="A pagar em aberto" value={money(aPagar)} tone="negative" />
              <KpiCard
                label="Liquidado no período"
                value={money(sumBy(payments.filter((p) => !p.is_reversal), (p) => p.amount))}
                hint={`${payments.filter((p) => p.is_reversal).length} estorno(s)`}
              />
              <KpiCard label="Saldo previsto" value={money(aReceber - aPagar)} />
            </div>

            <ReportTable
              title="Títulos com vencimento no período"
              rows={titles.map((t) => ({
                ...t,
                saldo: Math.max(0, t.total_amount - (paidById.get(t.id) ?? 0)),
              }))}
              searchFields={["description", "category", "status"]}
              initialSort={{ field: "due_date", direction: "asc" }}
              columns={
                [
                  { key: "due_date", label: "Vencimento", render: (r) => formatDateBR(r.due_date) },
                  { key: "kind", label: "Tipo", render: (r) => (r.kind === "receber" ? "A receber" : "A pagar") },
                  { key: "description", label: "Descrição" },
                  { key: "category", label: "Categoria", render: (r) => r.category || "—" },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => <Badge variant={statusTone(r.status)}>{r.status}</Badge>,
                  },
                  { key: "total_amount", label: "Valor", numeric: true, render: (r) => money(r.total_amount) },
                  { key: "saldo", label: "Saldo", numeric: true, render: (r) => money(r.saldo) },
                ] as Array<ReportColumn<(typeof titles)[number] & { saldo: number }>>
              }
              onRowSelect={(r) =>
                setDrill({
                  title: r.description,
                  lines: [
                    { label: "Tipo", value: r.kind === "receber" ? "A receber" : "A pagar" },
                    { label: "Vencimento", value: formatDateBR(r.due_date) },
                    { label: "Status", value: r.status },
                    { label: "Valor", value: money(r.total_amount) },
                    { label: "Saldo em aberto", value: money(r.saldo) },
                  ],
                  targetTab: "finance-titles",
                  targetLabel: "Abrir em Contas a Pagar/Receber",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    downloadReportCsv("relatorio-financeiro", range, titles, [
                      { key: "due_date", label: "Vencimento", value: (t) => formatDateBR(t.due_date) },
                      { key: "kind", label: "Tipo", value: (t) => (t.kind === "receber" ? "A receber" : "A pagar") },
                      { key: "description", label: "Descrição", value: (t) => t.description },
                      { key: "category", label: "Categoria", value: (t) => t.category ?? "" },
                      { key: "status", label: "Status", value: (t) => t.status },
                      { key: "total_amount", label: "Valor", value: (t) => csvNumber(t.total_amount) },
                      {
                        key: "saldo",
                        label: "Saldo",
                        value: (t) => csvNumber(Math.max(0, t.total_amount - (paidById.get(t.id) ?? 0))),
                      },
                    ])
                  }
                  disabled={denyValues}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>

        {/* ------------------------------------------------------ Eventos */}
        <TabsContent value="eventos" className="space-y-4">
          <SectionState
            isLoading={current.events.isLoading}
            isError={current.events.isError}
            denied={current.events.data?.denied}
            isEmpty={filteredEvents.length === 0}
            emptyMessage="Nenhum evento no período/filtros selecionados."
            onRetry={() => current.events.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Eventos" value={String(filteredEvents.length)} />
              <KpiCard label="Receita orçada" value={money(receitaEventos)} tone="positive" />
              <KpiCard label="Custos lançados" value={money(custoEventos)} tone="negative" />
              <KpiCard
                label="Margem"
                value={money(margemEventos)}
                hint={
                  receitaEventos > 0
                    ? `${formatPercent((margemEventos / receitaEventos) * 100)} da receita`
                    : "sem receita no período"
                }
              />
            </div>

            <ReportTable
              title="Eventos do período"
              rows={filteredEvents.map((e) => ({
                ...e,
                margem: Number(e.total_budget ?? 0) - Number(e.total_expenses ?? 0),
              }))}
              searchFields={["name", "client_name", "status"]}
              initialSort={{ field: "event_date", direction: "desc" }}
              columns={[
                { key: "event_date", label: "Data", render: (r) => formatDateBR(r.event_date) },
                { key: "name", label: "Evento" },
                { key: "client_name", label: "Cliente", render: (r) => r.client_name || "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Badge variant={statusTone(r.status)}>{r.status || "—"}</Badge>,
                },
                { key: "total_budget", label: "Orçado", numeric: true, render: (r) => money(Number(r.total_budget ?? 0)) },
                { key: "total_expenses", label: "Despesas", numeric: true, render: (r) => money(Number(r.total_expenses ?? 0)) },
                { key: "margem", label: "Margem", numeric: true, render: (r) => money(r.margem) },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: r.name,
                  lines: [
                    { label: "Data", value: formatDateBR(r.event_date) },
                    { label: "Cliente", value: r.client_name || "—" },
                    { label: "Status", value: r.status || "—" },
                    { label: "Orçado", value: money(Number(r.total_budget ?? 0)) },
                    { label: "Despesas", value: money(Number(r.total_expenses ?? 0)) },
                    { label: "Margem", value: money(r.margem) },
                    { label: "Pagamento recebido", value: r.is_paid ? "Sim" : "Não" },
                  ],
                  targetTab: "rentals",
                  targetLabel: "Abrir em Locações",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={denyValues}
                  onClick={() =>
                    downloadReportCsv("relatorio-eventos", range, filteredEvents, [
                      { key: "event_date", label: "Data", value: (e) => formatDateBR(e.event_date) },
                      { key: "name", label: "Evento", value: (e) => e.name },
                      { key: "client_name", label: "Cliente", value: (e) => e.client_name ?? "" },
                      { key: "status", label: "Status", value: (e) => e.status ?? "" },
                      { key: "total_budget", label: "Orçado", value: (e) => csvNumber(Number(e.total_budget ?? 0)) },
                      { key: "total_expenses", label: "Despesas", value: (e) => csvNumber(Number(e.total_expenses ?? 0)) },
                      {
                        key: "margem",
                        label: "Margem",
                        value: (e) => csvNumber(Number(e.total_budget ?? 0) - Number(e.total_expenses ?? 0)),
                      },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>

        {/* ----------------------------------------------------- Despesas */}
        <TabsContent value="despesas" className="space-y-4">
          <SectionState
            isLoading={current.expenses.isLoading}
            isError={current.expenses.isError}
            denied={current.expenses.data?.denied}
            isEmpty={filteredExpenses.length === 0}
            emptyMessage="Nenhuma despesa no período/filtros selecionados."
            onRetry={() => current.expenses.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Total de despesas"
                value={money(totalDespesas)}
                comparison={compare(totalDespesas, totalDespesasAnterior)}
                tone="negative"
              />
              <KpiCard label="Pagas" value={money(despesasPagas)} />
              <KpiCard label="Em aberto" value={money(totalDespesas - despesasPagas)} />
              <KpiCard label="Lançamentos" value={String(filteredExpenses.length)} />
            </div>

            <BreakdownList title="Por categoria" items={categoryBreakdown} format={money} />

            <ReportTable
              title="Despesas detalhadas"
              rows={filteredExpenses}
              searchFields={["description", "category", "supplier", "event_name"]}
              initialSort={{ field: "expense_date", direction: "desc" }}
              columns={[
                { key: "expense_date", label: "Data", render: (r) => formatDateBR(r.expense_date) },
                { key: "scope", label: "Origem", render: (r) => (r.scope === "evento" ? "Evento" : "Empresa") },
                { key: "description", label: "Descrição" },
                { key: "category", label: "Categoria", render: (r) => r.category || "—" },
                { key: "event_name", label: "Evento", render: (r) => r.event_name || "—" },
                { key: "total_price", label: "Valor", numeric: true, render: (r) => money(r.total_price) },
                {
                  key: "is_paid",
                  label: "Situação",
                  render: (r) => (
                    <Badge variant={r.is_paid ? "default" : "secondary"}>
                      {r.is_paid ? "Paga" : "Em aberto"}
                    </Badge>
                  ),
                },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: r.description,
                  lines: [
                    { label: "Data", value: formatDateBR(r.expense_date) },
                    { label: "Categoria", value: r.category || "—" },
                    { label: "Fornecedor", value: r.supplier || "—" },
                    { label: "Evento", value: r.event_name || "—" },
                    { label: "Valor", value: money(r.total_price) },
                    { label: "Situação", value: r.is_paid ? "Paga" : "Em aberto" },
                  ],
                  targetTab: r.scope === "evento" ? "rentals" : "expense-spreadsheet",
                  targetLabel: r.scope === "evento" ? "Abrir em Locações" : "Abrir em Gastos Empresa",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={denyValues}
                  onClick={() =>
                    downloadReportCsv("relatorio-despesas", range, filteredExpenses, [
                      { key: "expense_date", label: "Data", value: (e) => formatDateBR(e.expense_date) },
                      { key: "scope", label: "Origem", value: (e) => (e.scope === "evento" ? "Evento" : "Empresa") },
                      { key: "description", label: "Descrição", value: (e) => e.description },
                      { key: "category", label: "Categoria", value: (e) => e.category ?? "" },
                      { key: "supplier", label: "Fornecedor", value: (e) => e.supplier ?? "" },
                      { key: "event_name", label: "Evento", value: (e) => e.event_name ?? "" },
                      { key: "total_price", label: "Valor", value: (e) => csvNumber(e.total_price) },
                      { key: "is_paid", label: "Situação", value: (e) => (e.is_paid ? "Paga" : "Em aberto") },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>

        {/* ---------------------------------------------------- Comercial */}
        <TabsContent value="comercial" className="space-y-4">
          <SectionState
            isLoading={current.commercial.isLoading}
            isError={current.commercial.isError}
            denied={current.commercial.data?.denied}
            isEmpty={quotes.length === 0 && contracts.length === 0}
            emptyMessage="Nenhum orçamento ou contrato no período."
            onRetry={() => current.commercial.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Orçamentos" value={String(quotes.length)} hint={money(valorOrcado)} />
              <KpiCard label="Contratos" value={String(contracts.length)} hint={money(valorContratado)} />
              <KpiCard label="Conversão" value={formatPercent(conversao)} hint="contratos ÷ orçamentos" />
              <KpiCard
                label="Contratos assinados"
                value={String(contracts.filter((c) => c.signed_at).length)}
              />
            </div>

            <ReportTable
              title="Orçamentos"
              rows={quotes.map((q) => ({ ...q, total_amount: Number(q.total_amount ?? 0) }))}
              searchFields={["quote_number", "client_name", "event_name", "status"]}
              initialSort={{ field: "quote_date", direction: "desc" }}
              columns={[
                { key: "quote_date", label: "Data", render: (r) => formatDateBR(r.quote_date) },
                { key: "quote_number", label: "Número", render: (r) => r.quote_number || "—" },
                { key: "client_name", label: "Cliente", render: (r) => r.client_name || "—" },
                { key: "event_name", label: "Evento", render: (r) => r.event_name || "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Badge variant={statusTone(r.status)}>{r.status || "—"}</Badge>,
                },
                { key: "total_amount", label: "Valor", numeric: true, render: (r) => money(r.total_amount) },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: `Orçamento ${r.quote_number ?? ""}`.trim(),
                  lines: [
                    { label: "Data", value: formatDateBR(r.quote_date) },
                    { label: "Cliente", value: r.client_name || "—" },
                    { label: "Evento", value: r.event_name || "—" },
                    { label: "Status", value: r.status || "—" },
                    { label: "Valor", value: money(r.total_amount) },
                  ],
                  targetTab: "contracts",
                  targetLabel: "Abrir em Orçamentos",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={denyValues}
                  onClick={() =>
                    downloadReportCsv("relatorio-orcamentos", range, quotes, [
                      { key: "quote_date", label: "Data", value: (q) => formatDateBR(q.quote_date) },
                      { key: "quote_number", label: "Número", value: (q) => q.quote_number ?? "" },
                      { key: "client_name", label: "Cliente", value: (q) => q.client_name ?? "" },
                      { key: "event_name", label: "Evento", value: (q) => q.event_name ?? "" },
                      { key: "status", label: "Status", value: (q) => q.status ?? "" },
                      { key: "total_amount", label: "Valor", value: (q) => csvNumber(Number(q.total_amount ?? 0)) },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />

            <ReportTable
              title="Contratos"
              rows={contracts.map((c) => ({ ...c, total_value: Number(c.total_value ?? 0) }))}
              searchFields={["contract_number", "client_name", "status"]}
              initialSort={{ field: "start_date", direction: "desc" }}
              columns={[
                { key: "start_date", label: "Início", render: (r) => formatDateBR(r.start_date) },
                { key: "contract_number", label: "Número", render: (r) => r.contract_number || "—" },
                { key: "client_name", label: "Cliente", render: (r) => r.client_name || "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Badge variant={statusTone(r.status)}>{r.status || "—"}</Badge>,
                },
                { key: "total_value", label: "Valor", numeric: true, render: (r) => money(r.total_value) },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: `Contrato ${r.contract_number ?? ""}`.trim(),
                  lines: [
                    { label: "Início", value: formatDateBR(r.start_date) },
                    { label: "Cliente", value: r.client_name || "—" },
                    { label: "Status", value: r.status || "—" },
                    { label: "Assinado em", value: r.signed_at ? formatDateBR(r.signed_at) : "—" },
                    { label: "Valor", value: money(r.total_value) },
                  ],
                  targetTab: "contracts",
                  targetLabel: "Abrir em Orçamentos/Contratos",
                })
              }
            />
          </SectionState>
        </TabsContent>

        {/* ------------------------------------------------------ Pessoas */}
        <TabsContent value="pessoas" className="space-y-4">
          <SectionState
            isLoading={current.people.isLoading}
            isError={current.people.isError}
            denied={current.people.data?.denied}
            isEmpty={filteredRates.length === 0}
            emptyMessage="Nenhuma diária lançada no período."
            onRetry={() => current.people.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Diárias lançadas" value={String(filteredRates.length)} />
              <KpiCard label="Custo total" value={money(custoPessoas)} tone="negative" />
              <KpiCard
                label="Pendentes de pagamento"
                value={String(filteredRates.filter((r) => (r.payment_status ?? "pendente") !== "pago").length)}
              />
              <KpiCard
                label="Pessoas distintas"
                value={String(new Set(filteredRates.map((r) => r.worker_name)).size)}
              />
            </div>

            <BreakdownList
              title="Custo por pessoa"
              items={groupTotals(
                filteredRates,
                (r) => r.worker_name,
                (r) =>
                  r.amount +
                  (r.overtime_amount ?? 0) +
                  (r.food_amount ?? 0) +
                  (r.transport_amount ?? 0) -
                  (r.discount_amount ?? 0),
                "Sem nome",
              )}
              format={money}
            />

            <ReportTable
              title="Diárias detalhadas"
              rows={filteredRates.map((r) => ({
                ...r,
                total:
                  r.amount +
                  (r.overtime_amount ?? 0) +
                  (r.food_amount ?? 0) +
                  (r.transport_amount ?? 0) -
                  (r.discount_amount ?? 0),
              }))}
              searchFields={["worker_name", "event_name", "payment_status"]}
              initialSort={{ field: "date", direction: "desc" }}
              columns={[
                { key: "date", label: "Data", render: (r) => formatDateBR(r.date) },
                { key: "worker_name", label: "Pessoa" },
                { key: "event_name", label: "Evento", render: (r) => r.event_name || "—" },
                { key: "amount", label: "Diária", numeric: true, render: (r) => money(r.amount) },
                { key: "total", label: "Total", numeric: true, render: (r) => money(r.total) },
                {
                  key: "payment_status",
                  label: "Pagamento",
                  render: (r) => (
                    <Badge variant={statusTone(r.payment_status)}>{r.payment_status || "pendente"}</Badge>
                  ),
                },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: r.worker_name,
                  lines: [
                    { label: "Data", value: formatDateBR(r.date) },
                    { label: "Evento", value: r.event_name || "—" },
                    { label: "Diária", value: money(r.amount) },
                    { label: "Extras", value: money(r.total - r.amount) },
                    { label: "Total", value: money(r.total) },
                    { label: "Presença", value: r.attendance_status || "—" },
                    { label: "Pagamento", value: r.payment_status || "pendente" },
                  ],
                  targetTab: "daily-rates",
                  targetLabel: "Abrir em Diárias",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={denyValues}
                  onClick={() =>
                    downloadReportCsv("relatorio-diarias", range, filteredRates, [
                      { key: "date", label: "Data", value: (r) => formatDateBR(r.date) },
                      { key: "worker_name", label: "Pessoa", value: (r) => r.worker_name },
                      { key: "event_name", label: "Evento", value: (r) => r.event_name ?? "" },
                      { key: "amount", label: "Diária", value: (r) => csvNumber(r.amount) },
                      { key: "extras", label: "Extras", value: (r) => csvNumber((r.overtime_amount ?? 0) + (r.food_amount ?? 0) + (r.transport_amount ?? 0)) },
                      { key: "discount_amount", label: "Descontos", value: (r) => csvNumber(r.discount_amount ?? 0) },
                      { key: "payment_status", label: "Pagamento", value: (r) => r.payment_status ?? "pendente" },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>

        {/* ------------------------------------------------------ Estoque */}
        <TabsContent value="estoque" className="space-y-4">
          <SectionState
            isLoading={current.equipment.isLoading}
            isError={current.equipment.isError}
            denied={current.equipment.data?.denied}
            isEmpty={equipment.length === 0}
            emptyMessage="Nenhum equipamento cadastrado."
            onRetry={() => current.equipment.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Itens cadastrados" value={String(equipment.length)} />
              <KpiCard label="Unidades locadas" value={String(totalLocado)} />
              <KpiCard label="Ocupação do estoque" value={formatPercent(ocupacao)} />
              <KpiCard
                label="Abaixo do mínimo"
                value={String(emFalta.length)}
                tone={emFalta.length > 0 ? "negative" : "default"}
              />
            </div>

            <ReportTable
              title="Equipamentos"
              rows={equipment.map((e) => ({
                ...e,
                total_stock: Number(e.total_stock ?? 0),
                available: Number(e.available ?? 0),
                rented: Number(e.rented ?? 0),
              }))}
              searchFields={["name", "category", "status"]}
              initialSort={{ field: "rented", direction: "desc" }}
              columns={[
                { key: "name", label: "Equipamento" },
                { key: "category", label: "Categoria", render: (r) => r.category || "—" },
                { key: "total_stock", label: "Estoque", numeric: true },
                { key: "available", label: "Disponível", numeric: true },
                { key: "rented", label: "Locado", numeric: true },
                {
                  key: "price_per_day",
                  label: "Diária",
                  numeric: true,
                  render: (r) => money(Number(r.price_per_day ?? 0)),
                },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: r.name,
                  lines: [
                    { label: "Categoria", value: r.category || "—" },
                    { label: "Estoque total", value: String(r.total_stock) },
                    { label: "Disponível", value: String(r.available) },
                    { label: "Locado", value: String(r.rented) },
                    { label: "Estoque mínimo", value: String(r.min_stock ?? 0) },
                  ],
                  targetTab: "equipment",
                  targetLabel: "Abrir em Equipamentos",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    downloadReportCsv("relatorio-estoque", range, equipment, [
                      { key: "name", label: "Equipamento", value: (e) => e.name },
                      { key: "category", label: "Categoria", value: (e) => e.category ?? "" },
                      { key: "total_stock", label: "Estoque", value: (e) => String(e.total_stock ?? 0) },
                      { key: "available", label: "Disponível", value: (e) => String(e.available ?? 0) },
                      { key: "rented", label: "Locado", value: (e) => String(e.rented ?? 0) },
                      { key: "min_stock", label: "Mínimo", value: (e) => String(e.min_stock ?? 0) },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>

        {/* -------------------------------------------------- Notas fiscais */}
        <TabsContent value="notas" className="space-y-4">
          <SectionState
            isLoading={current.invoices.isLoading}
            isError={current.invoices.isError}
            denied={current.invoices.data?.denied}
            isEmpty={invoices.length === 0}
            emptyMessage="Nenhuma nota fiscal emitida no período."
            onRetry={() => current.invoices.refetch()}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Notas no período" value={String(invoices.length)} />
              <KpiCard label="Valor dos serviços" value={money(valorNotas)} />
              <KpiCard label="ISS" value={money(issNotas)} />
              <KpiCard
                label="Autorizadas"
                value={String(invoices.filter((i) => (i.status ?? "").toLowerCase() === "autorizada").length)}
              />
            </div>

            <ReportTable
              title="Notas fiscais"
              rows={invoices.map((i) => ({ ...i, service_value: Number(i.service_value ?? 0) }))}
              searchFields={["invoice_number", "taker_name", "status"]}
              initialSort={{ field: "issue_date", direction: "desc" }}
              columns={[
                { key: "issue_date", label: "Emissão", render: (r) => formatDateBR(r.issue_date) },
                { key: "invoice_number", label: "Nota", render: (r) => r.invoice_number || r.rps_number || "—" },
                { key: "taker_name", label: "Tomador", render: (r) => r.taker_name || "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <Badge variant={statusTone(r.status)}>{r.status || "—"}</Badge>,
                },
                { key: "service_value", label: "Serviço", numeric: true, render: (r) => money(r.service_value) },
                { key: "iss_value", label: "ISS", numeric: true, render: (r) => money(Number(r.iss_value ?? 0)) },
              ]}
              onRowSelect={(r) =>
                setDrill({
                  title: `Nota ${r.invoice_number ?? r.rps_number ?? ""}`.trim(),
                  lines: [
                    { label: "Emissão", value: formatDateBR(r.issue_date) },
                    { label: "Tomador", value: r.taker_name || "—" },
                    { label: "Status", value: r.status || "—" },
                    { label: "Serviço", value: money(r.service_value) },
                    { label: "ISS", value: money(Number(r.iss_value ?? 0)) },
                    { label: "Líquido", value: money(Number(r.net_value ?? 0)) },
                  ],
                  targetTab: "nfse",
                  targetLabel: "Abrir em Notas Fiscais",
                })
              }
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={denyValues}
                  onClick={() =>
                    downloadReportCsv("relatorio-notas-fiscais", range, invoices, [
                      { key: "issue_date", label: "Emissão", value: (i) => formatDateBR(i.issue_date) },
                      { key: "invoice_number", label: "Nota", value: (i) => i.invoice_number ?? i.rps_number ?? "" },
                      { key: "taker_name", label: "Tomador", value: (i) => i.taker_name ?? "" },
                      { key: "status", label: "Status", value: (i) => i.status ?? "" },
                      { key: "service_value", label: "Serviço", value: (i) => csvNumber(Number(i.service_value ?? 0)) },
                      { key: "iss_value", label: "ISS", value: (i) => csvNumber(Number(i.iss_value ?? 0)) },
                      { key: "net_value", label: "Líquido", value: (i) => csvNumber(Number(i.net_value ?? 0)) },
                    ])
                  }
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              }
            />
          </SectionState>
        </TabsContent>
      </Tabs>

      <Dialog open={!!drill} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{drill?.title}</DialogTitle>
            <DialogDescription>Origem do registro selecionado.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            {drill?.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4 border-b border-border pb-1">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="text-right font-medium">{line.value}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrill(null)}>
              Fechar
            </Button>
            {drill?.targetTab && onNavigate && (
              <Button
                onClick={() => {
                  onNavigate(drill.targetTab as string);
                  setDrill(null);
                }}
              >
                {drill.targetLabel ?? "Abrir origem"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};
