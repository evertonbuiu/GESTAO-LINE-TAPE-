import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RotateCcw } from "lucide-react";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  old_data: unknown;
  new_data: unknown;
}

const ENTITIES = [
  "bank_accounts",
  "bank_transactions",
  "nfse_invoices",
  "recurring_expenses",
  "recurring_expense_monthly_payments",
  "equipment",
  "events",
  "clients",
  "user_roles",
];

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Edição",
  DELETE: "Exclusão",
};

export const ActivityHistory = () => {
  const { userRole } = useCustomAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("id, actor_id, actor_name, action, entity_type, entity_id, created_at, old_data, new_data")
      .order("created_at", { ascending: false })
      .limit(200);

    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (action !== "all") query = query.eq("action", action);
    if (entity !== "all") query = query.eq("entity_type", entity);
    if (actor.trim()) query = query.ilike("actor_name", `%${actor.trim()}%`);

    const { data } = await query;
    setRows((data as AuditRow[]) ?? []);
    setLoading(false);
  }, [from, to, action, entity, actor]);

  useEffect(() => {
    if (userRole !== "admin") return;
    void load();
  }, [userRole, load]);

  const total = useMemo(() => rows.length, [rows]);

  if (userRole !== "admin") {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Acesso restrito a administradores.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>{total} registro(s) exibido(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label htmlFor="audit-from">De</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="audit-to">Até</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="audit-actor">Usuário</Label>
            <Input
              id="audit-actor"
              placeholder="Nome"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>
          <div>
            <Label>Ação</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Edição</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Entidade</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.action === "DELETE" ? "destructive" : r.action === "INSERT" ? "default" : "secondary"
                      }
                    >
                      {ACTION_LABEL[r.action] ?? r.action}
                    </Badge>
                    <span className="font-medium">{r.entity_type}</span>
                    <span className="text-muted-foreground">
                      {r.actor_name ?? "Sistema"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      {expanded === r.id ? "Ocultar" : "Detalhes"}
                    </Button>
                  </div>
                  {expanded === r.id && (
                    <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify({ antes: r.old_data, depois: r.new_data }, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
