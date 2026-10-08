import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Link2, Copy, FileCheck2, Search } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

interface QuoteRow {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  event_name: string | null;
  quote_date: string;
  total_amount: number;
  status: string | null;
}

interface ApprovalRow {
  id: string;
  quote_id: string;
  token: string;
  status: string;
  expires_at: string;
  accepted_name: string | null;
  accepted_at: string | null;
}

const generateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const publicUrl = (token: string) => `${window.location.origin}/orcamento/${token}`;

export const QuoteApprovals = () => {
  const { user, userRole } = useCustomAuth();
  const canManage = userRole === "admin" || userRole === "financeiro";

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [approvals, setApprovals] = useState<Record<string, ApprovalRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: quoteRows, error: qErr }, { data: approvalRows, error: aErr }] =
        await Promise.all([
          supabase
            .from("external_quotes")
            .select("id, quote_number, client_name, event_name, quote_date, total_amount, status")
            .order("quote_date", { ascending: false })
            .limit(150),
          supabase
            .from("quote_approvals")
            .select("id, quote_id, token, status, expires_at, accepted_name, accepted_at")
            .order("created_at", { ascending: false }),
        ]);
      if (qErr || aErr) throw qErr ?? aErr;

      setQuotes(quoteRows ?? []);
      const map: Record<string, ApprovalRow> = {};
      (approvalRows ?? []).forEach((a) => {
        if (!map[a.quote_id]) map[a.quote_id] = a as ApprovalRow;
      });
      setApprovals(map);
    } catch {
      setError("Não foi possível carregar os orçamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createLink = async (quoteId: string) => {
    setBusy(quoteId);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + days);
      const token = generateToken();
      const { error: err } = await supabase.from("quote_approvals").insert({
        quote_id: quoteId,
        token,
        status: "pendente",
        expires_at: expires.toISOString(),
        created_by: user?.id ?? null,
      });
      if (err) throw err;
      await navigator.clipboard?.writeText(publicUrl(token)).catch(() => undefined);
      toast.success("Link de aprovação gerado e copiado.");
      await load();
    } catch {
      toast.error("Não foi possível gerar o link.");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((r) =>
      [r.quote_number, r.client_name, r.event_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [quotes, search]);

  const statusBadge = (approval?: ApprovalRow) => {
    if (!approval) return <Badge variant="outline">Sem link</Badge>;
    const expired = new Date(approval.expires_at).getTime() < Date.now();
    if (approval.status === "aceito") return <Badge>Aceito</Badge>;
    if (approval.status === "recusado") return <Badge variant="destructive">Recusado</Badge>;
    if (expired || approval.status === "expirado")
      return <Badge variant="secondary">Expirado</Badge>;
    return <Badge variant="secondary">Aguardando cliente</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileCheck2 className="h-6 w-6" /> Aprovação de orçamentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Gere um link público expirável para o cliente aprovar ou recusar o orçamento.
        </p>
      </div>

      {!canManage && (
        <Alert>
          <AlertDescription>
            Seu perfil pode acompanhar o status, mas não gerar novos links.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orçamentos</CardTitle>
          <CardDescription>
            Cada link dá acesso apenas ao orçamento correspondente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por número, cliente ou evento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-40 space-y-1">
              <Label>Validade (dias)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 7)))}
              />
            </div>
            <Button variant="outline" onClick={() => void load()}>
              Atualizar
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((q) => {
                const approval = approvals[q.id];
                return (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center gap-3 rounded border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {q.quote_number ?? "Sem número"} — {q.client_name ?? "Sem cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {q.event_name ?? "Sem evento"} · {q.quote_date} · {brl(q.total_amount ?? 0)}
                      </p>
                      {approval?.status === "aceito" && (
                        <p className="text-xs text-green-600">
                          Aceito por {approval.accepted_name} em{" "}
                          {approval.accepted_at
                            ? new Date(approval.accepted_at).toLocaleString("pt-BR")
                            : "-"}
                        </p>
                      )}
                    </div>
                    {statusBadge(approval)}
                    {approval && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard?.writeText(publicUrl(approval.token));
                          toast.success("Link copiado.");
                        }}
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" /> Copiar link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={!canManage || busy === q.id}
                      onClick={() => void createLink(q.id)}
                    >
                      <Link2 className="mr-2 h-3.5 w-3.5" />
                      {approval ? "Novo link" : "Gerar link"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
