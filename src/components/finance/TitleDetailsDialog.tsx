import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  derivedInstallmentStatus,
  formatBRL,
  formatDateBR,
  netPaid,
  openBalance,
  todaySaoPaulo,
  validatePayment,
  type FinanceInstallment,
  type FinancePayment,
  type FinanceTitle,
} from "@/lib/finance";
import type { NewPaymentInput } from "@/hooks/useFinance";

interface Props {
  title: FinanceTitle | null;
  installments: FinanceInstallment[];
  payments: FinancePayment[];
  onOpenChange: (open: boolean) => void;
  onPay: (input: NewPaymentInput) => Promise<unknown>;
  onReverse: (paymentId: string) => Promise<unknown>;
}

const NONE = "__none__";

const statusTone: Record<string, string> = {
  pago: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  parcial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  pendente: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
  estornado: "bg-destructive/10 text-destructive border-destructive/30",
};

export const TitleDetailsDialog = ({
  title,
  installments,
  payments,
  onOpenChange,
  onPay,
  onReverse,
}: Props) => {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [installmentId, setInstallmentId] = useState<string>(NONE);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todaySaoPaulo());
  const [method, setMethod] = useState("pix");
  const [accountId, setAccountId] = useState(NONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!title) return;
    supabase
      .from("bank_accounts")
      .select("id,name")
      .order("name")
      .then(({ data }) => setAccounts((data ?? []) as Array<{ id: string; name: string }>));
  }, [title]);

  const pending = useMemo(
    () => installments.filter((i) => derivedInstallmentStatus(i, payments) !== "pago" && i.status !== "cancelado"),
    [installments, payments],
  );

  useEffect(() => {
    if (!title) return;
    const first = pending[0];
    setInstallmentId(first ? first.id : NONE);
    setAmount("");
    setPaidAt(todaySaoPaulo());
    setError(null);
  }, [title, pending]);

  if (!title) return null;

  const selected = installmentId === NONE ? null : installments.find((i) => i.id === installmentId) ?? null;
  const scopePayments = selected ? payments.filter((p) => p.installment_id === selected.id) : payments;
  const scopeTotal = selected ? selected.amount : title.total_amount;
  const remaining = openBalance(scopeTotal, scopePayments);
  const parsedAmount = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;

  const handlePay = async () => {
    const value = parsedAmount > 0 ? parsedAmount : remaining;
    const check = validatePayment(title, { amount: value }, payments, selected);
    if (!check.ok) return setError(check.error ?? "Pagamento inválido.");
    setBusy(true);
    setError(null);
    try {
      await onPay({
        titleId: title.id,
        installmentId: selected?.id ?? null,
        amount: value,
        paidAt,
        method,
        bankAccountId: accountId === NONE ? null : accountId,
      });
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar pagamento.");
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (paymentId: string) => {
    setBusy(true);
    setError(null);
    try {
      await onReverse(paymentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao estornar.");
    } finally {
      setBusy(false);
    }
  };

  const locked = title.status === "cancelado" || title.status === "estornado";

  return (
    <Dialog open={!!title} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title.description}
            <Badge variant="outline" className={statusTone[title.status] ?? ""}>{title.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {title.kind === "receber" ? "Conta a receber" : "Conta a pagar"} · vence em {formatDateBR(title.due_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Valor do título</p>
            <p className="text-lg font-semibold">{formatBRL(title.total_amount)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Liquidado</p>
            <p className="text-lg font-semibold text-emerald-600">{formatBRL(netPaid(payments))}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="text-lg font-semibold">{formatBRL(openBalance(title.total_amount, payments))}</p>
          </div>
        </div>

        <section aria-label="Parcelas">
          <h3 className="mb-2 text-sm font-medium">Parcelas</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {installments.map((inst) => {
              const st = derivedInstallmentStatus(inst, payments);
              return (
                <li key={inst.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {inst.number}/{installments.length} · {formatDateBR(inst.due_date)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{formatBRL(inst.amount)}</span>
                    <Badge variant="outline" className={statusTone[st] ?? ""}>{st}</Badge>
                  </span>
                </li>
              );
            })}
            {installments.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Sem parcelas cadastradas.</li>
            )}
          </ul>
        </section>

        {!locked && (
          <>
            <Separator />
            <section aria-label="Registrar pagamento" className="grid gap-3 sm:grid-cols-2">
              <h3 className="sm:col-span-2 text-sm font-medium">Registrar pagamento</h3>

              <div>
                <Label>Parcela</Label>
                <Select value={installmentId} onValueChange={setInstallmentId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Título inteiro</SelectItem>
                    {pending.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.number}/{installments.length} · {formatBRL(i.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fp-amount">Valor (vazio = {formatBRL(remaining)})</Label>
                <Input
                  id="fp-amount"
                  inputMode="decimal"
                  placeholder={remaining.toFixed(2).replace(".", ",")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="fp-date">Data</Label>
                <Input id="fp-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>

              <div>
                <Label>Forma</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pix", "transferencia", "dinheiro", "cartao", "boleto"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label>Conta bancária (lança no livro-caixa)</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem conta (apenas registro)</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Button onClick={handlePay} disabled={busy || remaining <= 0} className="w-full sm:w-auto">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar pagamento
                </Button>
              </div>
            </section>
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Separator />
        <section aria-label="Histórico de pagamentos">
          <h3 className="mb-2 text-sm font-medium">Histórico</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="text-muted-foreground">
                  {formatDateBR(p.paid_at)} · {p.method ?? "—"}
                </span>
                <span className="flex items-center gap-2">
                  <span className={p.is_reversal ? "text-destructive" : "text-emerald-600"}>
                    {p.is_reversal ? "-" : "+"}{formatBRL(p.amount)}
                  </span>
                  {!p.is_reversal && !payments.some((r) => r.reverses_payment_id === p.id) && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleReverse(p.id)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Estornar
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {payments.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Nenhum pagamento registrado.</li>
            )}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
};
