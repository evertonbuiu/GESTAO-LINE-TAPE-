import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, BarChart3, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

import { PageActions } from "@/components/layout/PageHeader";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const firstDayOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

interface EventRow {
  id: string;
  name: string;
  client_name: string | null;
  event_date: string;
  total_budget: number | null;
  total_expenses: number | null;
  is_paid: boolean | null;
  is_remaining_paid: boolean | null;
  payment_amount: number | null;
  remaining_payment_amount: number | null;
  status: string | null;
}

interface EquipmentUsage {
  equipment_name: string;
  quantity: number;
  events: Set<string>;
}

export const ManagementDashboard = () => {
  const [start, setStart] = useState(firstDayOfYear());
  const [end, setEnd] = useState(today());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [usage, setUsage] = useState<EquipmentUsage[]>([]);
  const [maintenanceCost, setMaintenanceCost] = useState(0);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [equipmentRented, setEquipmentRented] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState<Array<{ category: string; total: number }>>([]);
  const [cashflow, setCashflow] = useState<{ income: number; expense: number }>({
    income: 0,
    expense: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRes, eqRes, useRes, mntRes, expRes, txRes] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, client_name, event_date, total_budget, total_expenses, is_paid, is_remaining_paid, payment_amount, remaining_payment_amount, status",
          )
          .gte("event_date", start)
          .lte("event_date", end)
          .limit(1000),
        supabase.from("equipment").select("total_stock, rented").limit(1000),
        supabase
          .from("event_equipment")
          .select("equipment_name, quantity, event_id, events!inner(event_date)")
          .gte("events.event_date", start)
          .lte("events.event_date", end)
          .limit(1000),
        supabase
          .from("maintenance_records")
          .select("cost")
          .gte("scheduled_date", start)
          .lte("scheduled_date", end)
          .limit(1000),
        supabase
          .from("event_expenses")
          .select("category, total_price")
          .gte("expense_date", start)
          .lte("expense_date", end)
          .limit(1000),
        supabase
          .from("bank_transactions")
          .select("transaction_type, amount")
          .gte("transaction_date", start)
          .lte("transaction_date", end)
          .limit(1000),
      ]);

      const firstError =
        eventRes.error || eqRes.error || useRes.error || mntRes.error || expRes.error || txRes.error;
      if (firstError) throw firstError;

      setEvents((eventRes.data ?? []) as EventRow[]);

      setEquipmentTotal((eqRes.data ?? []).reduce((s, e) => s + (e.total_stock ?? 0), 0));
      setEquipmentRented((eqRes.data ?? []).reduce((s, e) => s + (e.rented ?? 0), 0));

      const usageMap = new Map<string, EquipmentUsage>();
      (useRes.data ?? []).forEach((row) => {
        const key = row.equipment_name;
        const entry = usageMap.get(key) ?? {
          equipment_name: key,
          quantity: 0,
          events: new Set<string>(),
        };
        entry.quantity += row.quantity ?? 0;
        entry.events.add(row.event_id);
        usageMap.set(key, entry);
      });
      setUsage([...usageMap.values()].sort((a, b) => b.quantity - a.quantity));

      setMaintenanceCost((mntRes.data ?? []).reduce((s, m) => s + Number(m.cost ?? 0), 0));

      const catMap = new Map<string, number>();
      (expRes.data ?? []).forEach((e) => {
        const key = e.category ?? "Sem categoria";
        catMap.set(key, (catMap.get(key) ?? 0) + Number(e.total_price ?? 0));
      });
      setExpensesByCategory(
        [...catMap.entries()]
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total),
      );

      const income = (txRes.data ?? [])
        .filter((t) => t.transaction_type === "income")
        .reduce((s, t) => s + Number(t.amount ?? 0), 0);
      const expense = (txRes.data ?? [])
        .filter((t) => t.transaction_type === "expense")
        .reduce((s, t) => s + Number(t.amount ?? 0), 0);
      setCashflow({ income, expense });
    } catch {
      setError("Não foi possível carregar os indicadores do período.");
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const profitability = useMemo(
    () =>
      events
        .map((e) => {
          const revenue = Number(e.total_budget ?? 0);
          const cost = Number(e.total_expenses ?? 0);
          return {
            id: e.id,
            name: e.name,
            client: e.client_name ?? "Sem cliente",
            date: e.event_date,
            revenue,
            cost,
            profit: revenue - cost,
            margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit),
    [events],
  );

  const byClient = useMemo(() => {
    const map = new Map<string, { client: string; revenue: number; cost: number }>();
    profitability.forEach((p) => {
      const entry = map.get(p.client) ?? { client: p.client, revenue: 0, cost: 0 };
      entry.revenue += p.revenue;
      entry.cost += p.cost;
      map.set(p.client, entry);
    });
    return [...map.values()]
      .map((c) => ({ ...c, profit: c.revenue - c.cost }))
      .sort((a, b) => b.profit - a.profit);
  }, [profitability]);

  const receivables = useMemo(
    () =>
      events
        .map((e) => {
          const budget = Number(e.total_budget ?? 0);
          const received =
            (e.is_paid ? Number(e.payment_amount ?? 0) : 0) +
            (e.is_remaining_paid ? Number(e.remaining_payment_amount ?? 0) : 0);
          return { ...e, pending: Math.max(0, budget - received), received };
        })
        .filter((e) => e.pending > 0.01)
        .sort((a, b) => (a.event_date < b.event_date ? -1 : 1)),
    [events],
  );

  const overdue = receivables.filter((r) => r.event_date < today());
  const totalRevenue = profitability.reduce((s, p) => s + p.revenue, 0);
  const totalCost = profitability.reduce((s, p) => s + p.cost, 0);
  const occupancy = equipmentTotal > 0 ? (equipmentRented / equipmentTotal) * 100 : 0;

  const chartData = useMemo(
    () => [
      { name: "Previsto", Receitas: totalRevenue, Despesas: totalCost },
      { name: "Realizado", Receitas: cashflow.income, Despesas: cashflow.expense },
    ],
    [totalRevenue, totalCost, cashflow],
  );

  const kpi = (label: string, value: string, hint?: string) => (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      <PageActions>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Aplicar
          </Button>
        </div>
      </PageActions>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando indicadores…
        </div>
      ) : events.length === 0 && usage.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dado no período selecionado. Ajuste as datas e tente novamente.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpi("Ocupação de equipamentos", `${occupancy.toFixed(1)}%`, `${equipmentRented} de ${equipmentTotal}`)}
            {kpi("Receita prevista", brl(totalRevenue), `${events.length} evento(s)`)}
            {kpi("Lucro previsto", brl(totalRevenue - totalCost))}
            {kpi("Custo de manutenção", brl(maintenanceCost))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo previsto x realizado</CardTitle>
              <CardDescription>
                Previsto: orçamentos e despesas dos eventos. Realizado: movimentações bancárias.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="hsl(var(--primary))" />
                  <Bar dataKey="Despesas" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Tabs defaultValue="eventos">
            <TabsList className="flex-wrap">
              <TabsTrigger value="eventos">Rentabilidade por evento</TabsTrigger>
              <TabsTrigger value="clientes">Por cliente</TabsTrigger>
              <TabsTrigger value="categorias">Por categoria</TabsTrigger>
              <TabsTrigger value="equipamentos">Uso de equipamentos</TabsTrigger>
              <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
            </TabsList>

            <TabsContent value="eventos">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Eventos do período</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={profitability.length === 0}
                    onClick={() =>
                      downloadCsv("rentabilidade-eventos", profitability as never, [
                        { key: "name", label: "Evento" },
                        { key: "client", label: "Cliente" },
                        { key: "date", label: "Data" },
                        { key: "revenue", label: "Receita" },
                        { key: "cost", label: "Custo" },
                        { key: "profit", label: "Lucro" },
                        { key: "margin", label: "Margem %" },
                      ])
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profitability.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum evento no período.</p>
                  )}
                  {profitability.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-3 rounded border border-border p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.client} · {p.date}
                        </p>
                      </div>
                      <span className="text-muted-foreground">{brl(p.revenue)}</span>
                      <span className={p.profit >= 0 ? "text-green-600" : "text-destructive"}>
                        {brl(p.profit)}
                      </span>
                      <Badge variant="outline">{p.margin.toFixed(1)}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clientes">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Rentabilidade por cliente</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={byClient.length === 0}
                    onClick={() => downloadCsv("rentabilidade-clientes", byClient as never)}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {byClient.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  )}
                  {byClient.map((c) => (
                    <div
                      key={c.client}
                      className="flex items-center justify-between gap-3 rounded border border-border p-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{c.client}</span>
                      <span className="text-muted-foreground">{brl(c.revenue)}</span>
                      <span className={c.profit >= 0 ? "text-green-600" : "text-destructive"}>
                        {brl(c.profit)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categorias">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Despesas por categoria</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={expensesByCategory.length === 0}
                    onClick={() => downloadCsv("despesas-categoria", expensesByCategory as never)}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {expensesByCategory.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
                  )}
                  {expensesByCategory.map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center justify-between gap-3 rounded border border-border p-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{c.category}</span>
                      <span className="font-medium">{brl(c.total)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equipamentos">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mais utilizados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {usage.slice(0, 10).map((u) => (
                      <div
                        key={u.equipment_name}
                        className="flex items-center justify-between gap-3 rounded border border-border p-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">{u.equipment_name}</span>
                        <Badge variant="outline">{u.events.size} evento(s)</Badge>
                        <span className="font-medium">{u.quantity} un.</span>
                      </div>
                    ))}
                    {usage.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem uso no período.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Menos utilizados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {usage
                      .slice()
                      .reverse()
                      .slice(0, 10)
                      .map((u) => (
                        <div
                          key={u.equipment_name}
                          className="flex items-center justify-between gap-3 rounded border border-border p-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">{u.equipment_name}</span>
                          <span className="font-medium">{u.quantity} un.</span>
                        </div>
                      ))}
                    {usage.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem uso no período.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="recebimentos">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Próximos pagamentos e inadimplência</CardTitle>
                    <CardDescription>
                      {overdue.length} evento(s) vencido(s) sem quitação total.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={receivables.length === 0}
                    onClick={() =>
                      downloadCsv("recebimentos", receivables as never, [
                        { key: "name", label: "Evento" },
                        { key: "client_name", label: "Cliente" },
                        { key: "event_date", label: "Data" },
                        { key: "received", label: "Recebido" },
                        { key: "pending", label: "Pendente" },
                      ])
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivables.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nada pendente no período.</p>
                  )}
                  {receivables.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 rounded border border-border p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.client_name ?? "Sem cliente"} · {r.event_date}
                        </p>
                      </div>
                      {r.event_date < today() && <Badge variant="destructive">Vencido</Badge>}
                      <span className="font-medium">{brl(r.pending)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
