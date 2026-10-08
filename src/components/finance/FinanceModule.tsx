import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { useFinance } from "@/hooks/useFinance";
import { TitleFormDialog } from "./TitleFormDialog";
import { TitleDetailsDialog } from "./TitleDetailsDialog";
import {
  buildBudgetVsActual,
  buildProjection,
  buildSnapshot,
  formatBRL,
  formatDateBR,
  netPaid,
  openBalance,
  todaySaoPaulo,
  type FinanceTitle,
} from "@/lib/finance";

const statusTone: Record<string, string> = {
  pago: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  pendente: "bg-muted text-muted-foreground",
  aprovado: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  rascunho: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
  estornado: "bg-destructive/10 text-destructive border-destructive/30",
};

const ALL = "__all__";

export const FinanceModule = () => {
  const {
    canOperate,
    titles,
    installments,
    payments,
    paymentsByTitle,
    installmentsByTitle,
    loading,
    error,
    refresh,
    createTitle,
    registerPayment,
    reversePayment,
  } = useFinance();

  const [formKind, setFormKind] = useState<"receber" | "pagar" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [events, setEvents] = useState<Array<{ id: string; name: string; total_budget?: number | null }>>([]);

  useEffect(() => {
    if (!canOperate) return;
    (async () => {
      const [accs, evs] = await Promise.all([
        supabase.from("bank_accounts").select("current_balance,balance"),
        supabase.from("events").select("id,name,total_budget").order("event_date", { ascending: false }).limit(50),
      ]);
      const total = (accs.data ?? []).reduce(
        (acc: number, a: { current_balance?: number | null; balance?: number | null }) =>
          acc + Number(a.current_balance ?? a.balance ?? 0),
        0,
      );
      setOpeningBalance(total);
      setEvents((evs.data ?? []) as typeof events);
    })();
  }, [canOperate]);

  const today = todaySaoPaulo();
  const snapshot = useMemo(() => buildSnapshot(titles, payments, today), [titles, payments, today]);
  const projection = useMemo(
    () => buildProjection(titles, payments, openingBalance, 6, today),
    [titles, payments, openingBalance, today],
  );
  const budgetVsActual = useMemo(
    () => buildBudgetVsActual(events, titles, payments),
    [events, titles, payments],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return titles.filter((t) => {
      if (term && !`${t.description} ${t.supplier_name ?? ""} ${t.category ?? ""}`.toLowerCase().includes(term))
        return false;
      if (statusFilter !== ALL && t.status !== statusFilter) return false;
      if (from && t.due_date < from) return false;
      if (to && t.due_date > to) return false;
      return true;
    });
  }, [titles, search, statusFilter, from, to]);

  const byKind = (kind: "receber" | "pagar") => filtered.filter((t) => t.kind === kind);

  const exportTitles = (rows: FinanceTitle[], name: string) => {
    downloadCsv(
      name,
      rows.map((t) => ({
        descricao: t.description,
        tipo: t.kind,
        status: t.status,
        vencimento: formatDateBR(t.due_date),
        valor: t.total_amount,
        liquidado: netPaid(paymentsByTitle.get(t.id) ?? []),
        em_aberto: openBalance(t.total_amount, paymentsByTitle.get(t.id) ?? []),
        categoria: t.category ?? "",
        centro_custo: t.cost_center ?? "",
      })),
    );
  };

  const exportLedger = () => {
    downloadCsv(
      "livro-caixa",
      payments.map((p) => {
        const t = titles.find((x) => x.id === p.title_id);
        return {
          data: formatDateBR(p.paid_at),
          titulo: t?.description ?? "",
          tipo: t?.kind ?? "",
          natureza: p.is_reversal ? "estorno" : "pagamento",
          valor: p.is_reversal ? -p.amount : p.amount,
          forma: p.method ?? "",
        };
      }),
    );
  };

  if (!canOperate) {
    return (
      <Alert>
        <AlertDescription>
          Este módulo está disponível apenas para os perfis administrador e financeiro.
        </AlertDescription>
      </Alert>
    );
  }

  const detailTitle = titles.find((t) => t.id === detailId) ?? null;

  const TitleList = ({ kind }: { kind: "receber" | "pagar" }) => {
    const rows = byKind(kind);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rows.length} título(s)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportTitles(rows, `contas-a-${kind}`)}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => setFormKind(kind)}>
              <Plus className="mr-2 h-4 w-4" /> Novo
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((t) => {
            const tp = paymentsByTitle.get(t.id) ?? [];
            const open = openBalance(t.total_amount, tp);
            const overdue = open > 0 && t.due_date < today && t.status !== "cancelado";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setDetailId(t.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      Vence {formatDateBR(t.due_date)}
                      {t.category ? ` · ${t.category}` : ""}
                      {(installmentsByTitle.get(t.id)?.length ?? 0) > 1
                        ? ` · ${installmentsByTitle.get(t.id)?.length}x`
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-right">
                      <span className="block font-semibold">{formatBRL(t.total_amount)}</span>
                      <span className="block text-xs text-muted-foreground">Aberto {formatBRL(open)}</span>
                    </span>
                    <Badge variant="outline" className={statusTone[t.status] ?? ""}>
                      {overdue && t.status !== "pago" ? "vencido" : t.status}
                    </Badge>
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">Nenhum título encontrado.</li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas a Pagar e Receber</h1>
          <p className="text-sm text-muted-foreground">
            Títulos, parcelas, pagamentos parciais e estornos com rastreio no livro-caixa.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> A receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatBRL(snapshot.aReceber)}</p>
            <p className="text-xs text-muted-foreground">Vencido: {formatBRL(snapshot.vencidoReceber)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ArrowUpCircle className="h-4 w-4 text-destructive" /> A pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatBRL(snapshot.aPagar)}</p>
            <p className="text-xs text-muted-foreground">Vencido: {formatBRL(snapshot.vencidoPagar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-emerald-600">+{formatBRL(snapshot.recebido)}</p>
            <p className="text-lg font-semibold text-destructive">-{formatBRL(snapshot.pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Saldo previsto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${snapshot.saldoPrevisto < 0 ? "text-destructive" : "text-emerald-600"}`}>
              {formatBRL(snapshot.saldoPrevisto)}
            </p>
            <p className="text-xs text-muted-foreground">Caixa atual: {formatBRL(openingBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar títulos"
              className="pl-9"
              placeholder="Buscar descrição, fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {["rascunho", "pendente", "aprovado", "pago", "cancelado", "estornado"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label="Vencimento de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="Vencimento até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="receber">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="receber">A receber</TabsTrigger>
          <TabsTrigger value="pagar">A pagar</TabsTrigger>
          <TabsTrigger value="caixa">Livro-caixa</TabsTrigger>
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
          <TabsTrigger value="eventos">Orçado x realizado</TabsTrigger>
        </TabsList>

        <TabsContent value="receber" className="mt-4"><TitleList kind="receber" /></TabsContent>
        <TabsContent value="pagar" className="mt-4"><TitleList kind="pagar" /></TabsContent>

        <TabsContent value="caixa" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportLedger}>
              <Download className="mr-2 h-4 w-4" /> Exportar livro-caixa
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {payments.map((p) => {
              const t = titles.find((x) => x.id === p.title_id);
              const isIn = t?.kind === "receber";
              const sign = p.is_reversal ? !isIn : isIn;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {p.is_reversal ? "Estorno · " : ""}{t?.description ?? "Título"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateBR(p.paid_at)} · {p.method ?? "—"}
                    </span>
                  </span>
                  <span className={`font-semibold ${sign ? "text-emerald-600" : "text-destructive"}`}>
                    {sign ? "+" : "-"}{formatBRL(p.amount)}
                  </span>
                </li>
              );
            })}
            {payments.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">Sem movimentos registrados.</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="previsao" className="mt-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="p-3">Mês</th>
                  <th scope="col" className="p-3">Entradas previstas</th>
                  <th scope="col" className="p-3">Saídas previstas</th>
                  <th scope="col" className="p-3">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((p) => (
                  <tr key={p.month} className="border-t border-border">
                    <td className="p-3">{p.month}</td>
                    <td className="p-3 text-emerald-600">{formatBRL(p.previstoEntrada)}</td>
                    <td className="p-3 text-destructive">{formatBRL(p.previstoSaida)}</td>
                    <td className={`p-3 font-medium ${p.saldoAcumulado < 0 ? "text-destructive" : ""}`}>
                      {formatBRL(p.saldoAcumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="eventos" className="mt-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="p-3">Evento</th>
                  <th scope="col" className="p-3">Orçado</th>
                  <th scope="col" className="p-3">Receita</th>
                  <th scope="col" className="p-3">Custo</th>
                  <th scope="col" className="p-3">Margem</th>
                </tr>
              </thead>
              <tbody>
                {budgetVsActual.map((r) => (
                  <tr key={r.eventId} className="border-t border-border">
                    <td className="p-3">{r.eventName}</td>
                    <td className="p-3">{formatBRL(r.orcado)}</td>
                    <td className="p-3 text-emerald-600">{formatBRL(r.receitaRealizada)}</td>
                    <td className="p-3 text-destructive">{formatBRL(r.custoRealizado)}</td>
                    <td className={`p-3 font-medium ${r.margem < 0 ? "text-destructive" : ""}`}>
                      {formatBRL(r.margem)} ({r.margemPercentual}%)
                    </td>
                  </tr>
                ))}
                {budgetVsActual.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">Sem eventos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <TitleFormDialog
        open={formKind !== null}
        kind={formKind ?? "receber"}
        onOpenChange={(v) => !v && setFormKind(null)}
        onSubmit={createTitle}
      />

      <TitleDetailsDialog
        title={detailTitle}
        installments={detailTitle ? installmentsByTitle.get(detailTitle.id) ?? [] : []}
        payments={detailTitle ? paymentsByTitle.get(detailTitle.id) ?? [] : []}
        onOpenChange={(v) => !v && setDetailId(null)}
        onPay={registerPayment}
        onReverse={reversePayment}
      />
    </div>
  );
};

export default FinanceModule;
