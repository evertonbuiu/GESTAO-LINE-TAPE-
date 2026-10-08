import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildInstallments, formatBRL, formatDateBR, todaySaoPaulo } from "@/lib/finance";
import type { NewTitleInput } from "@/hooks/useFinance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "receber" | "pagar";
  onSubmit: (input: NewTitleInput) => Promise<unknown>;
}

interface Option {
  id: string;
  label: string;
}

const NONE = "__none__";

export const TitleFormDialog = ({ open, onOpenChange, kind, onSubmit }: Props) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todaySaoPaulo());
  const [installments, setInstallments] = useState("1");
  const [category, setCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [supplier, setSupplier] = useState("");
  const [clientId, setClientId] = useState(NONE);
  const [eventId, setEventId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Option[]>([]);
  const [events, setEvents] = useState<Option[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [c, e] = await Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("events").select("id,name,event_date").order("event_date", { ascending: false }).limit(200),
      ]);
      setClients((c.data ?? []).map((r: { id: string; name: string }) => ({ id: r.id, label: r.name })));
      setEvents(
        (e.data ?? []).map((r: { id: string; name: string; event_date: string }) => ({
          id: r.id,
          label: `${r.name} · ${formatDateBR(r.event_date)}`,
        })),
      );
    })();
  }, [open]);

  const parsedAmount = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;
  const parsedCount = Math.max(1, Number(installments) || 1);

  const preview = useMemo(() => {
    if (parsedAmount <= 0) return [];
    try {
      return buildInstallments(parsedAmount, parsedCount, dueDate);
    } catch {
      return [];
    }
  }, [parsedAmount, parsedCount, dueDate]);

  const reset = () => {
    setDescription("");
    setAmount("");
    setDueDate(todaySaoPaulo());
    setInstallments("1");
    setCategory("");
    setCostCenter("");
    setSupplier("");
    setClientId(NONE);
    setEventId(NONE);
    setNotes("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!description.trim()) return setError("Informe a descrição.");
    if (parsedAmount <= 0) return setError("Informe um valor maior que zero.");
    if (!dueDate) return setError("Informe o vencimento.");

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        description: description.trim(),
        total_amount: parsedAmount,
        due_date: dueDate,
        category: category.trim() || null,
        cost_center: costCenter.trim() || null,
        supplier_name: kind === "pagar" ? supplier.trim() || null : null,
        client_id: clientId === NONE ? null : clientId,
        event_id: eventId === NONE ? null : eventId,
        notes: notes.trim() || null,
        installments: parsedCount,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o título.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!saving ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "receber" ? "Nova conta a receber" : "Nova conta a pagar"}</DialogTitle>
          <DialogDescription>
            Informe o título e as parcelas. O lançamento no caixa acontece no momento do pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="ft-desc">Descrição *</Label>
            <Input id="ft-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="ft-amount">Valor total (R$) *</Label>
            <Input
              id="ft-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ft-due">Primeiro vencimento *</Label>
            <Input id="ft-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="ft-inst">Parcelas</Label>
            <Input
              id="ft-inst"
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ft-cat">Categoria</Label>
            <Input id="ft-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="ft-cc">Centro de custo</Label>
            <Input id="ft-cc" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />
          </div>

          {kind === "pagar" && (
            <div>
              <Label htmlFor="ft-sup">Fornecedor</Label>
              <Input id="ft-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          )}

          {kind === "receber" && (
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="sm:col-span-2">
            <Label>Evento</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem evento</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="ft-notes">Observações</Label>
            <Textarea id="ft-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {preview.length > 1 && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="mb-2 font-medium">Parcelas geradas</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {preview.map((p) => (
                <li key={p.number} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{p.number}/{preview.length} · {formatDateBR(p.due_date)}</span>
                  <span>{formatBRL(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar título
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
