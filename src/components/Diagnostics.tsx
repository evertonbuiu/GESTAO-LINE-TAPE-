import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { APP_BUILD } from "@/lib/buildInfo";

interface ErrorRow {
  id: string;
  message: string;
  route: string | null;
  created_at: string;
  user_agent: string | null;
}

export const Diagnostics = () => {
  const { userRole } = useCustomAuth();
  const { isOnline, checkForUpdate, clearOldCaches } = usePWAUpdate();
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "error">("checking");
  const [swStatus, setSwStatus] = useState("verificando…");

  const load = useCallback(async () => {
    setLoading(true);
    const start = Date.now();
    const { data, error } = await supabase
      .from("app_error_logs")
      .select("id, message, route, created_at, user_agent")
      .order("created_at", { ascending: false })
      .limit(30);
    setDbStatus(error ? "error" : "ok");
    setErrors((data as ErrorRow[]) ?? []);
    setLoading(false);
    return Date.now() - start;
  }, []);

  useEffect(() => {
    if (userRole !== "admin") return;
    void load();
  }, [userRole, load]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwStatus("não suportado");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) setSwStatus("não registrado (dev/preview)");
      else if (reg.waiting) setSwStatus("nova versão aguardando");
      else if (reg.active) setSwStatus("ativo");
      else setSwStatus("instalando");
    });
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold">Diagnóstico do sistema</h1>
        <p className="text-sm text-muted-foreground">
          Saúde da aplicação, atualizações e erros recentes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Versão / build</CardDescription>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {import.meta.env.MODE} · {APP_BUILD}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conexão</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={dbStatus === "ok" ? "default" : dbStatus === "error" ? "destructive" : "outline"}>
              {dbStatus === "ok" ? "Conectado" : dbStatus === "error" ? "Falha" : "Verificando"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Service worker</CardDescription>
          </CardHeader>
          <CardContent className="text-sm font-medium">{swStatus}</CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            const found = await checkForUpdate();
            toast[found ? "success" : "info"](
              found ? "Nova versão encontrada" : "Você já está na versão mais recente",
            );
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Verificar atualização
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const n = await clearOldCaches();
            toast.success(`${n} cache(s) antigo(s) removido(s)`);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Limpar caches antigos
        </Button>
        <Button variant="ghost" onClick={() => void load()}>
          <Activity className="mr-2 h-4 w-4" /> Recarregar erros
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Erros recentes</CardTitle>
          <CardDescription>Últimos 30 registros de app_error_logs.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            <div className="space-y-2">
              {errors.map((e) => (
                <div key={e.id} className="rounded border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.message}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.route ?? "-"} · {e.user_agent?.slice(0, 80) ?? "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
