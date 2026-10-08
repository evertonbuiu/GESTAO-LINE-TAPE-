import { useMemo, useState } from "react";
import { Bell, AlertTriangle, PackageX, RotateCcw, Wrench, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOperationalAlerts } from "@/hooks/useOperationalAlerts";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { downloadCsv } from "@/lib/csv";
import type { OperationalAlert } from "@/lib/alerts";

const CATEGORY_META = {
  estoque: { label: "Estoque abaixo do mínimo", icon: PackageX },
  devolucao: { label: "Devoluções atrasadas", icon: RotateCcw },
  manutencao: { label: "Manutenção", icon: Wrench },
  evento: { label: "Eventos em 48h", icon: CalendarClock },
} as const;

const severityVariant = (s: OperationalAlert["severity"]) =>
  s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";

const AlertRow = ({
  alert,
  onNavigate,
}: {
  alert: OperationalAlert;
  onNavigate?: (tab: string) => void;
}) => {
  const Icon = CATEGORY_META[alert.category].icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(alert.tab)}
      className="flex w-full items-start gap-3 rounded border border-border p-3 text-left hover:bg-muted/60"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{alert.description}</p>
      </div>
      <Badge variant={severityVariant(alert.severity)} className="shrink-0">
        {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Info"}
      </Badge>
    </button>
  );
};

/** Sino no cabeçalho com contadores. */
export const AlertsBell = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  const { userRole } = useCustomAuth();
  const { alerts, loading, error } = useOperationalAlerts(!!userRole);
  const [open, setOpen] = useState(false);

  const criticals = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Central de alertas">
          <Bell className="h-5 w-5" />
          {alerts.length > 0 && (
            <span
              className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground ${
                criticals > 0 ? "bg-destructive" : "bg-primary"
              }`}
            >
              {alerts.length > 99 ? "99+" : alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b border-border p-3">
          <p className="text-sm font-semibold">Central de alertas</p>
          <p className="text-xs text-muted-foreground">
            {loading ? "Carregando…" : `${alerts.length} alerta(s) ativo(s)`}
          </p>
        </div>
        <div className="max-h-80 space-y-2 overflow-auto p-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && alerts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
          )}
          {alerts.slice(0, 12).map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              onNavigate={(tab) => {
                onNavigate(tab);
                setOpen(false);
              }}
            />
          ))}
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              onNavigate("alerts");
              setOpen(false);
            }}
          >
            Ver todos os alertas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Página completa da central de alertas. */
export const AlertsCenter = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { userRole } = useCustomAuth();
  const { alerts, loading, error, reload } = useOperationalAlerts(!!userRole);

  const byCategory = useMemo(() => {
    return (Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((key) => ({
      key,
      ...CATEGORY_META[key],
      items: alerts.filter((a) => a.category === key),
    }));
  }, [alerts]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Central de alertas</h1>
          <p className="text-sm text-muted-foreground">
            Estoque, devoluções, manutenção e eventos próximos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={alerts.length === 0}
            onClick={() =>
              downloadCsv("alertas", alerts as unknown as Array<Record<string, unknown>>, [
                { key: "category", label: "Categoria" },
                { key: "severity", label: "Severidade" },
                { key: "title", label: "Item" },
                { key: "description", label: "Detalhe" },
                { key: "date", label: "Data" },
              ])
            }
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {byCategory.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <c.icon className="h-4 w-4" /> {c.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{c.items.length}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo em dia. Nenhum alerta ativo.</p>
          ) : (
            <Tabs defaultValue="todos">
              <TabsList className="flex-wrap">
                <TabsTrigger value="todos">Todos ({alerts.length})</TabsTrigger>
                {byCategory.map((c) => (
                  <TabsTrigger key={c.key} value={c.key}>
                    {c.label} ({c.items.length})
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="todos" className="space-y-2">
                {alerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onNavigate={onNavigate} />
                ))}
              </TabsContent>
              {byCategory.map((c) => (
                <TabsContent key={c.key} value={c.key} className="space-y-2">
                  {c.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
                  ) : (
                    c.items.map((a) => <AlertRow key={a.id} alert={a} onNavigate={onNavigate} />)
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
