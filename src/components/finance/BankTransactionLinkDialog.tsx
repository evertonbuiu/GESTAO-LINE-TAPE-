import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AccountTx } from "@/lib/accounts";

type Destination = "event" | "collaborator" | "worker" | "company" | "fixed" | "personal";
type IncomeKind = "total" | "entry" | "remaining";
type IncomeDestination = "event" | "company" | "transfer" | "other";
type AccountOption = { id: string; name: string };
type Option = {
  id: string;
  name: string;
  event_date?: string;
  total_budget?: number | null;
  payment_amount?: number | null;
  remaining_payment_amount?: number | null;
};

const incomeKindLabels: Record<IncomeKind, string> = {
  total: "Valor total do evento",
  entry: "Entrada / sinal do evento",
  remaining: "Pagamento restante do evento",
};

const incomeDestinationLabels: Record<IncomeDestination, string> = {
  event: "Receita de evento",
  company: "Receita da empresa",
  transfer: "Transferência entre contas",
  other: "Outras receitas",
};

const categories: Record<Destination, string[]> = {
  event: ["Materiais", "Mão de Obra", "Transporte", "Alimentação", "Hospedagem", "Equipamentos", "Fornecedores", "Outros"],
  collaborator: ["Notinha", "Adiantamento", "Vale", "Salário", "Alimentação", "Transporte", "Outros"],
  worker: ["Notinha", "Adiantamento", "Vale", "Diária", "Alimentação", "Transporte", "Outros"],
  company: ["Materiais", "Manutenção", "Combustível", "Alimentação", "Transporte", "Equipamentos", "Serviços", "Impostos", "Aluguel", "Outros"],
  fixed: ["Aluguel", "Água", "Luz", "Internet", "Telefone", "Seguros", "Impostos", "Salários", "Contador", "Outros"],
  personal: ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Outros"],
};

const labels: Record<Destination, string> = {
  event: "Evento", collaborator: "Colaborador", worker: "Diarista", company: "Gasto da empresa",
  fixed: "Despesa fixa", personal: "Gasto pessoal",
};

export function BankTransactionLinkDialog({ transaction, open, onOpenChange, onLinked }: {
  transaction: AccountTx | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [destination, setDestination] = useState<Destination>("event");
  const [events, setEvents] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [entityId, setEntityId] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventMonth, setEventMonth] = useState("");
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("entry");
  const [incomeDestination, setIncomeDestination] = useState<IncomeDestination>("event");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("Receitas diversas");
  const [category, setCategory] = useState(categories.event[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !transaction) return;
    setDescription(transaction.description);
    setDestination("event"); setEntityId(""); setEventId(""); setCategory(categories.event[0]);
    setEventMonth(transaction.date.slice(0, 7));
    setIncomeKind("entry");
    setIncomeDestination("event");
    setSourceAccountId("");
    setIncomeCategory("Receitas diversas");
    void Promise.all([
      supabase.from("events").select("id,name,event_date,total_budget,payment_amount,remaining_payment_amount").order("event_date", { ascending: false }),
      supabase.from("collaborators").select("id,name").order("name"),
      supabase.from("bank_accounts").select("id,name").order("name"),
    ]).then(([eventResult, peopleResult, accountResult]) => {
      setEvents((eventResult.data || []) as Option[]);
      setPeople((peopleResult.data || []) as Option[]);
      setAccounts((accountResult.data || []) as AccountOption[]);
    });
  }, [open, transaction]);

  useEffect(() => {
    setCategory(categories[destination][0]); setEntityId("");
    if (destination === "collaborator") {
      void supabase.from("collaborators").select("id,name").order("name").then(({ data }) => setPeople((data || []) as Option[]));
    } else if (destination === "worker") {
      void supabase.from("workers").select("id,name").order("name").then(({ data }) => setPeople((data || []) as Option[]));
    }
  }, [destination]);

  const needsPerson = destination === "collaborator" || destination === "worker";
  const isIncome = transaction?.type === "income";
  const eventMonths = useMemo(() => Array.from(new Set(events
    .map((event) => event.event_date?.slice(0, 7))
    .filter((month): month is string => Boolean(month)))).sort().reverse(), [events]);
  const filteredEvents = useMemo(() => events.filter((event) => !eventMonth || event.event_date?.startsWith(eventMonth)), [events, eventMonth]);
  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);
  const availableSourceAccounts = useMemo(() => accounts.filter((account) => account.id !== transaction?.accountId), [accounts, transaction?.accountId]);
  const selectedPerson = useMemo(() => people.find((p) => p.id === entityId), [people, entityId]);

  const confirm = async () => {
    if (!transaction || (isIncome && incomeDestination === "event" && !eventId) || (isIncome && incomeDestination === "transfer" && !sourceAccountId) || (!isIncome && destination === "event" && !eventId) || (!isIncome && needsPerson && !entityId)) return;
    setBusy(true);
    try {
      if (isIncome) {
        if (incomeDestination === "transfer") {
          const transferId = crypto.randomUUID();
          const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
          const { error: counterpartError } = await supabase.from("bank_transactions").insert({
            bank_account_id: sourceAccountId,
            transaction_date: transaction.date,
            transaction_time: transaction.time || null,
            description: `Transferência para ${accounts.find((account) => account.id === transaction.accountId)?.name || "conta de destino"}`,
            category: "Transferência entre contas",
            transaction_type: "expense",
            amount: transaction.amount,
            reference_type: "account_transfer_out",
            reference_id: transferId,
          });
          if (counterpartError) throw counterpartError;
          const { error: transferError } = await supabase.from("bank_transactions").update({
            description: `Transferência de ${sourceAccount?.name || "conta de origem"}`,
            category: "Transferência entre contas",
            reference_type: "account_transfer_in",
            reference_id: transferId,
          }).eq("id", transaction.id);
          if (transferError) throw transferError;
          toast({ title: "Transferência vinculada", description: `Origem: ${sourceAccount?.name || "conta selecionada"}.` });
          onOpenChange(false);
          await onLinked();
          return;
        }

        if (incomeDestination !== "event") {
          const categoryName = incomeDestination === "company" ? "Receita da empresa" : incomeCategory.trim() || "Outras receitas";
          const { error: incomeError } = await supabase.from("bank_transactions").update({
            reference_type: incomeDestination === "company" ? "company_income" : "other_income",
            reference_id: transaction.id,
            category: categoryName,
            description,
          }).eq("id", transaction.id);
          if (incomeError) throw incomeError;
          toast({ title: "Entrada registrada", description: `Vinculada em ${categoryName}.` });
          onOpenChange(false);
          await onLinked();
          return;
        }

        const eventUpdate = incomeKind === "remaining"
          ? {
              remaining_payment_amount: transaction.amount,
              remaining_payment_date: transaction.date,
              remaining_payment_bank_account: "C6 BANK",
              is_remaining_paid: true,
            }
          : {
              payment_amount: transaction.amount,
              payment_date: transaction.date,
              payment_bank_account: "C6 BANK",
              payment_type: incomeKind === "total" ? "total" : "entrada",
              is_paid: true,
            };
        const { error: eventError } = await supabase.from("events").update(eventUpdate).eq("id", eventId);
        if (eventError) throw eventError;
        const categoryName = incomeKindLabels[incomeKind];
        const { error: transactionError } = await supabase.from("bank_transactions").update({
          reference_type: incomeKind === "remaining" ? "event_remaining_payment" : "event_payment",
          reference_id: eventId,
          category: categoryName,
          description: `${categoryName}: ${selectedEvent?.name || description}`,
        }).eq("id", transaction.id);
        if (transactionError) throw transactionError;
        toast({ title: "Entrada vinculada", description: `${categoryName} registrado em ${selectedEvent?.name || "evento"}.` });
        onOpenChange(false);
        await onLinked();
        return;
      }
      const common = { description, category, quantity: 1, unit_price: transaction.amount, total_price: transaction.amount, expense_date: transaction.date };
      let result: { data: { id: string } | null; error: unknown };
      let referenceType = "expense";
      if (destination === "event" || needsPerson) {
        result = await supabase.from("event_expenses").insert({
          ...common,
          event_id: eventId || null,
          description: selectedPerson ? `${selectedPerson.name} - ${description}` : description,
          reference_type: needsPerson ? destination : "bank_statement",
          reference_id: needsPerson ? entityId : transaction.id,
          notes: `Registrado a partir do extrato C6. Tipo: ${labels[destination]}.`,
        }).select("id").single();
        referenceType = "event_expense";
      } else if (destination === "company") {
        result = await supabase.from("company_expenses").insert(common).select("id").single();
        referenceType = "company_expense";
      } else if (destination === "fixed") {
        const { data: auth } = await supabase.auth.getUser();
        result = await supabase.from("recurring_expenses").insert({ name: description, description: "Registrado pelo extrato C6", category, amount: transaction.amount, due_day: Number(transaction.date.slice(-2)), created_by: auth.user?.id || null }).select("id").single();
        referenceType = "recurring_expense";
      } else {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Sessão expirada");
        result = await supabase.from("personal_expenses").insert({ owner_id: auth.user.id, description, amount_cents: Math.round(transaction.amount * 100), expense_date: transaction.date, kind: "expense", notes: `Categoria: ${category}. Registrado pelo extrato C6.` }).select("id").single();
      }
      if (result.error || !result.data) throw result.error || new Error("Registro não criado");
      await supabase.from("bank_transactions").delete().eq("reference_id", result.data.id).neq("id", transaction.id);
      const { error } = await supabase.from("bank_transactions").update({ reference_type: referenceType, reference_id: result.data.id, category }).eq("id", transaction.id);
      if (error) throw error;
      toast({ title: "Lançamento registrado", description: `Vinculado em ${labels[destination]}.` });
      onOpenChange(false); await onLinked();
    } catch (error) {
      toast({ title: "Erro ao registrar", description: error instanceof Error ? error.message : "Não foi possível vincular o lançamento.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Registrar lançamento do C6</DialogTitle><DialogDescription>Escolha onde este lançamento deve ser registrado no sistema.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        {isIncome && <div><Label>Registrar entrada como</Label><Select value={incomeDestination} onValueChange={(value: IncomeDestination) => { setIncomeDestination(value); setEventId(""); setSourceAccountId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(incomeDestinationLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
        {!isIncome && <div><Label>Destino</Label><Select value={destination} onValueChange={(v: Destination) => setDestination(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>}
        {((isIncome && incomeDestination === "event") || (!isIncome && (destination === "event" || needsPerson))) && <>
          <div><Label>Filtrar eventos por mês</Label><Select value={eventMonth || "all"} onValueChange={(value) => { setEventMonth(value === "all" ? "" : value); setEventId(""); }}><SelectTrigger><SelectValue placeholder="Todos os meses" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os meses</SelectItem>{eventMonths.map((month) => { const [year, number] = month.split("-"); return <SelectItem key={month} value={month}>{new Date(Number(year), Number(number) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>; })}</SelectContent></Select></div>
          <div><Label>Evento {(isIncome && incomeDestination === "event") || destination === "event" ? "*" : "(opcional)"}</Label><Select value={eventId || "none"} onValueChange={(v) => setEventId(v === "none" ? "" : v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{!isIncome && needsPerson && <SelectItem value="none">Sem evento</SelectItem>}{filteredEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.name} {e.event_date ? `— ${e.event_date.split("-").reverse().join("/")}` : ""}</SelectItem>)}</SelectContent></Select></div>
        </>}
        {isIncome && incomeDestination === "event" && <div><Label>Tipo de entrada</Label><Select value={incomeKind} onValueChange={(value: IncomeKind) => setIncomeKind(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(incomeKindLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
        {isIncome && incomeDestination === "event" && selectedEvent && <div className="rounded-md border p-3 text-sm"><div><strong>Valor do evento:</strong> R$ {Number(selectedEvent.total_budget || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div><strong>Entrada registrada:</strong> R$ {Number(selectedEvent.payment_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>}
        {isIncome && incomeDestination === "transfer" && <div><Label>Conta de origem *</Label><Select value={sourceAccountId} onValueChange={setSourceAccountId}><SelectTrigger><SelectValue placeholder="Escolha a conta que enviou" /></SelectTrigger><SelectContent>{availableSourceAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>}
        {isIncome && incomeDestination === "other" && <div><Label>Categoria da receita</Label><Input value={incomeCategory} onChange={(event) => setIncomeCategory(event.target.value)} placeholder="Ex.: reembolso, venda, rendimento" /></div>}
        {!isIncome && needsPerson && <div><Label>{labels[destination]} *</Label><Select value={entityId} onValueChange={setEntityId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>}
        {!isIncome && <div><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories[destination].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>}
        <div><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="rounded-md border p-3 text-sm"><strong>Valor:</strong> R$ {transaction?.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={busy || !description || (isIncome && incomeDestination === "event" && !eventId) || (isIncome && incomeDestination === "transfer" && !sourceAccountId) || (!isIncome && destination === "event" && !eventId) || (!isIncome && needsPerson && !entityId)} onClick={confirm}>{busy ? "Registrando..." : "Registrar e vincular"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
