import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface QuoteProduct {
  description?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  total_price?: number;
}

interface PublicQuote {
  quote_number?: string | null;
  quote_date?: string | null;
  client_name?: string | null;
  event_name?: string | null;
  event_location?: string | null;
  event_date?: string | null;
  products?: QuoteProduct[] | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  travel_expense?: number | null;
  accommodation_expense?: number | null;
  total_amount?: number | null;
  valid_until?: string | null;
  notes?: string | null;
}

interface ApiResponse {
  status?: string;
  expires_at?: string;
  accepted_name?: string | null;
  accepted_at?: string | null;
  quote?: PublicQuote;
  error?: string;
}

const brl = (v?: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const QuoteApproval = () => {
  const { token = "" } = useParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const call = useCallback(
    async (action: "get" | "accept" | "reject", payload: Record<string, unknown> = {}) => {
      const { data: result, error: err } = await supabase.functions.invoke<ApiResponse>(
        "quote-approval",
        { body: { token, action, ...payload } },
      );
      if (err) {
        // Erros HTTP trazem a mensagem no corpo da resposta
        const response = (err as { context?: Response }).context;
        let message = (result as ApiResponse | null)?.error ?? null;
        if (!message && response && typeof response.json === "function") {
          const body = (await response.json().catch(() => null)) as ApiResponse | null;
          message = body?.error ?? null;
        }
        throw new Error(message ?? "Não foi possível processar a solicitação.");
      }

      if (result?.error) throw new Error(result.error);
      return result as ApiResponse;
    },
    [token],
  );

  useEffect(() => {
    void (async () => {
      try {
        setData(await call("get"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Link inválido.");
      } finally {
        setLoading(false);
      }
    })();
  }, [call]);

  const submit = async (action: "accept" | "reject") => {
    setSubmitting(true);
    setError(null);
    try {
      await call(action, action === "accept" ? { name } : { reason });
      setData(await call("get"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar sua resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error ?? "Link inválido ou expirado."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const quote = data.quote;
  const products = Array.isArray(quote.products) ? quote.products : [];
  const decided = data.status === "aceito" || data.status === "recusado";
  const expired = data.status === "expirado";

  return (
    <main className="min-h-screen bg-muted/30 p-4 md:p-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="text-center">
          <h1 className="text-2xl font-bold">Aprovação de orçamento</h1>
          <p className="text-sm text-muted-foreground">
            {quote.quote_number ? `Orçamento ${quote.quote_number}` : "Resumo do orçamento"}
          </p>
        </header>

        {data.status === "aceito" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Orçamento aceito por {data.accepted_name} em{" "}
              {data.accepted_at ? new Date(data.accepted_at).toLocaleString("pt-BR") : "-"}. Esta é
              a versão aceita.
            </AlertDescription>
          </Alert>
        )}
        {data.status === "recusado" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Este orçamento foi recusado.</AlertDescription>
          </Alert>
        )}
        {expired && (
          <Alert variant="destructive">
            <AlertDescription>Este link expirou. Solicite um novo à LINE TAPE.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{quote.event_name ?? "Evento"}</CardTitle>
                <CardDescription>
                  {quote.client_name ?? "Cliente"} · {quote.event_date ?? quote.quote_date ?? ""}
                  {quote.event_location ? ` · ${quote.event_location}` : ""}
                </CardDescription>
              </div>
              <Badge variant={data.status === "pendente" ? "secondary" : "outline"}>
                {data.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem itens detalhados.</p>
              ) : (
                products.map((p, i) => (
                  <div
                    key={`${p.description ?? p.name ?? "item"}-${i}`}
                    className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      {p.description ?? p.name ?? "Item"}
                      {p.quantity ? ` — ${p.quantity}x` : ""}
                    </span>
                    <span className="font-medium">{brl(p.total ?? p.total_price ?? 0)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{brl(quote.subtotal)}</span>
              </div>
              {!!quote.discount_amount && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto</span>
                  <span>- {brl(quote.discount_amount)}</span>
                </div>
              )}
              {!!quote.travel_expense && (
                <div className="flex justify-between">
                  <span>Deslocamento</span>
                  <span>{brl(quote.travel_expense)}</span>
                </div>
              )}
              {!!quote.accommodation_expense && (
                <div className="flex justify-between">
                  <span>Hospedagem</span>
                  <span>{brl(quote.accommodation_expense)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span>{brl(quote.total_amount)}</span>
              </div>
            </div>

            {quote.notes && (
              <p className="rounded bg-muted p-3 text-sm text-muted-foreground">{quote.notes}</p>
            )}
          </CardContent>
        </Card>

        {!decided && !expired && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sua resposta</CardTitle>
              <CardDescription>
                Ao aceitar, registramos seu nome, a data/hora e a versão do orçamento aprovado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <Label htmlFor="approver-name">Nome completo</Label>
                <Input
                  id="approver-name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Quem está aprovando"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reject-reason">Motivo (caso recuse)</Label>
                <Textarea
                  id="reject-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={submitting || name.trim().length < 3}
                  onClick={() => void submit("accept")}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aceitar orçamento
                </Button>
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void submit("reject")}
                >
                  Recusar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default QuoteApproval;
