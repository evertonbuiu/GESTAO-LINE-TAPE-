import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { usePersonalExpenses } from "@/hooks/usePersonalExpenses";
import {
  PersonalExpenseRow,
  budgetStatuses,
  effectiveRows,
  formatCents,
  formatDateBR,
  monthKey,
  reversedIds,
  summarize,
  toCents,
  toCsv,
  todaySP,
  totalsByCategory,
  validateExpenseDraft,
} from "@/lib/personalExpenses";
import { collectLegacyLocalExpenses } from "@/lib/personalLegacyImport";
import {
  Download,
  Lock,
  Plus,
  Printer,
  RefreshCcw,
  Undo2,
  Upload,
  Wallet,
} from "lucide-react";

const PAYMENT_METHODS = [
  "Dinheiro",
  "Cartão de Débito",
  "Cartão de Crédito",
  "PIX",
  "Transferência",
  "Outros",
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const PersonalExpensesPanel = () => {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const data = usePersonalExpenses(year, month);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "expense" | "income">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const [openExpense, setOpenExpense] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reversing, setReversing] = useState<PersonalExpenseRow | null>(null);
  const [importing, setImporting] = useState(false);

  const [draft, setDraft] = useState({
    description: "",
    amount: 0,
    expense_date: todaySP(),
    kind: "expense" as "expense" | "income",
    payment_method: "",
    notes: "",
    category_id: "",
    account_id: "",
    installments: 1,
  });

  const [newCategory, setNewCategory] = useState({ name: "", kind: "expense" as const });
  const [newAccount, setNewAccount] = useState({ name: "", type: "wallet", balance: 0 });
  const [budgetDraft, setBudgetDraft] = useState({ category_id: "", limit: 0 });

  const reversed = useMemo(() => reversedIds(data.expenses), [data.expenses]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.expenses.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (categoryFilter !== "all" && r.category_id !== categoryFilter) return false;
      if (accountFilter !== "all" && r.account_id !== accountFilter) return false;
      if (!term) return true;
      return (
        r.description.toLowerCase().includes(term) ||
        (r.notes ?? "").toLowerCase().includes(term) ||
        (r.payment_method ?? "").toLowerCase().includes(term)
      );
    });
  }, [data.expenses, search, kindFilter, categoryFilter, accountFilter]);

  const summary = useMemo(() => summarize(filtered), [filtered]);
  const byCategory = useMemo(
    () => totalsByCategory(filtered, data.categories),
    [filtered, data.categories],
  );
  const budgets = useMemo(
    () => budgetStatuses(data.budgets, data.expenses, data.categories, monthKey(year, month)),
    [data.budgets, data.expenses, data.categories, year, month],
  );

  const resetDraft = () =>
    setDraft({
      description: "",
      amount: 0,
      expense_date: todaySP(),
      kind: "expense",
      payment_method: "",
      notes: "",
      category_id: "",
      account_id: "",
      installments: 1,
    });

  const handleSaveExpense = async () => {
    const amount_cents = toCents(draft.amount);
    const errors = validateExpenseDraft({
      description: draft.description,
      amount_cents,
      expense_date: draft.expense_date,
      kind: draft.kind,
    });
    if (errors.length) {
      toast({ title: "Dados inválidos", description: errors.join(" "), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await data.createExpense({
        description: draft.description.trim(),
        amount_cents,
        expense_date: draft.expense_date,
        kind: draft.kind,
        payment_method: draft.payment_method || null,
        notes: draft.notes || null,
        category_id: draft.category_id || null,
        account_id: draft.account_id || null,
        installments: Math.max(1, Number(draft.installments) || 1),
      });
      toast({ title: "Lançamento salvo" });
      setOpenExpense(false);
      resetDraft();
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async () => {
    if (!reversing) return;
    try {
      await data.reverseExpense(reversing);
      toast({ title: "Estorno registrado" });
    } catch (err) {
      toast({
        title: "Erro ao estornar",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setReversing(null);
    }
  };

  const handleLegacyImport = async () => {
    const legacy = collectLegacyLocalExpenses();
    if (!legacy.length) {
      toast({ title: "Nada para importar", description: "Nenhum registro antigo encontrado." });
      return;
    }
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const item of legacy) {
      try {
        await data.createExpense({
          description: item.description,
          amount_cents: item.amount_cents,
          expense_date: item.expense_date,
          kind: "expense",
          payment_method: item.payment_method,
          notes: item.notes,
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    toast({
      title: "Importação concluída",
      description: `${ok} importados, ${failed} ignorados. Os dados locais foram preservados.`,
    });
  };

  const handleCsv = () => {
    const csv = toCsv(filtered, data.categories);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-pessoais-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-semibold">Gastos Pessoais</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Privado: somente você tem acesso a estes dados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void data.reload()} aria-label="Recarregar">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
          <Button onClick={() => setOpenExpense(true)}><Plus className="h-4 w-4 mr-1" /> Novo lançamento</Button>
        </div>
      </div>

      {data.error && (
        <Card className="border-destructive print:hidden">
          <CardContent className="py-4 text-sm text-destructive">{data.error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Receitas</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">
            {formatCents(summary.incomeCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Gastos</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">
            -{formatCents(summary.expenseCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Saldo do mês</CardDescription></CardHeader>
          <CardContent
            className={`text-2xl font-semibold ${summary.balanceCents < 0 ? "text-destructive" : "text-emerald-600"}`}
          >
            {formatCents(summary.balanceCents)}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lancamentos" className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4 print:hidden">
            <Input
              placeholder="Buscar descrição, observação ou forma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {data.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="print:pb-2">
              <CardTitle className="text-base">
                {MONTHS[month - 1]} / {year} — {filtered.length} lançamento(s)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="print:hidden text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.loading && (
                      <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>
                    )}
                    {!data.loading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          Nenhum lançamento no período.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((r) => {
                      const isReversedRow = reversed.has(r.id);
                      const isReversalRow = !!r.reverses_id;
                      return (
                        <TableRow key={r.id} className={isReversedRow ? "opacity-60" : ""}>
                          <TableCell className="whitespace-nowrap">{formatDateBR(r.expense_date)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={isReversedRow ? "line-through" : ""}>{r.description}</span>
                              {r.installment_total && (
                                <Badge variant="outline">
                                  {r.installment_number}/{r.installment_total}
                                </Badge>
                              )}
                              {isReversedRow && <Badge variant="secondary">Estornado</Badge>}
                              {isReversalRow && <Badge variant="outline">Estorno</Badge>}
                            </div>
                            {r.notes && (
                              <p className="text-xs text-muted-foreground">{r.notes}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {data.categories.find((c) => c.id === r.category_id)?.name ?? "—"}
                          </TableCell>
                          <TableCell>{r.payment_method ?? "—"}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${r.kind === "income" ? "text-emerald-600" : "text-destructive"}`}
                          >
                            {r.kind === "income" ? "" : "-"}
                            {formatCents(r.amount_cents)}
                          </TableCell>
                          <TableCell className="print:hidden text-right">
                            {!isReversedRow && !isReversalRow && (
                              <Button variant="ghost" size="sm" onClick={() => setReversing(r)}>
                                <Undo2 className="h-4 w-4 mr-1" /> Estornar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {byCategory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Gastos por categoria</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="font-medium">{formatCents(c.cents)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova categoria</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                className="w-56"
                placeholder="Nome"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <Button
                onClick={async () => {
                  if (!newCategory.name.trim()) return;
                  try {
                    await data.createCategory({ name: newCategory.name.trim(), kind: "expense" });
                    setNewCategory({ name: "", kind: "expense" });
                    toast({ title: "Categoria criada" });
                  } catch (err) {
                    toast({
                      title: "Erro",
                      description: err instanceof Error ? err.message : "Falha",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Adicionar
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              {data.categories.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
              )}
              {data.categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span className={c.archived ? "text-muted-foreground line-through" : ""}>{c.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void data.archiveCategory(c.id, !c.archived)}
                  >
                    {c.archived ? "Reativar" : "Arquivar"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova conta pessoal</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2 items-center">
              <Input
                className="w-48"
                placeholder="Nome"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              />
              <CurrencyInput
                className="w-40"
                value={newAccount.balance}
                onChange={(v) => setNewAccount({ ...newAccount, balance: v })}
              />
              <Button
                onClick={async () => {
                  if (!newAccount.name.trim()) return;
                  try {
                    await data.createAccount({
                      name: newAccount.name.trim(),
                      type: newAccount.type,
                      initial_balance_cents: toCents(newAccount.balance),
                    });
                    setNewAccount({ name: "", type: "wallet", balance: 0 });
                    toast({ title: "Conta criada" });
                  } catch (err) {
                    toast({
                      title: "Erro",
                      description: err instanceof Error ? err.message : "Falha",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Wallet className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              {data.accounts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
              )}
              {data.accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span className={a.archived ? "text-muted-foreground line-through" : ""}>
                    {a.name} — {formatCents(a.initial_balance_cents)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void data.archiveAccount(a.id, !a.archived)}
                  >
                    {a.archived ? "Reativar" : "Arquivar"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limite do mês</CardTitle>
              <CardDescription>Defina um teto por categoria para {MONTHS[month - 1]}/{year}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 items-center">
              <Select
                value={budgetDraft.category_id}
                onValueChange={(v) => setBudgetDraft({ ...budgetDraft, category_id: v })}
              >
                <SelectTrigger className="w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {data.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CurrencyInput
                className="w-40"
                value={budgetDraft.limit}
                onChange={(v) => setBudgetDraft({ ...budgetDraft, limit: v })}
              />
              <Button
                onClick={async () => {
                  if (!budgetDraft.category_id || budgetDraft.limit <= 0) return;
                  try {
                    await data.upsertBudget(budgetDraft.category_id, toCents(budgetDraft.limit));
                    setBudgetDraft({ category_id: "", limit: 0 });
                    toast({ title: "Orçamento salvo" });
                  } catch (err) {
                    toast({
                      title: "Erro",
                      description: err instanceof Error ? err.message : "Falha",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Salvar
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {budgets.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum orçamento definido para o mês.</p>
              )}
              {budgets.map((b) => (
                <div key={`${b.categoryId}`} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={b.exceeded ? "text-destructive font-medium" : ""}>
                      {formatCents(b.spentCents)} / {formatCents(b.limitCents)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, b.usedPercent)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importar dados antigos do navegador</CardTitle>
              <CardDescription>
                Copia os gastos salvos localmente para a sua conta. Os dados locais não são apagados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleLegacyImport} disabled={importing}>
                <Upload className="h-4 w-4 mr-1" />
                {importing ? "Importando..." : "Importar do navegador"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={openExpense} onOpenChange={setOpenExpense}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Descrição</Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Valor</Label>
                <CurrencyInput
                  value={draft.amount}
                  onChange={(v) => setDraft({ ...draft, amount: v })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={draft.expense_date}
                  onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Tipo</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft({ ...draft, kind: v as "expense" | "income" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.installments}
                  onChange={(e) => setDraft({ ...draft, installments: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Categoria</Label>
                <Select
                  value={draft.category_id}
                  onValueChange={(v) => setDraft({ ...draft, category_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {data.categories.filter((c) => !c.archived).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Conta</Label>
                <Select
                  value={draft.account_id}
                  onValueChange={(v) => setDraft({ ...draft, account_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {data.accounts.filter((a) => !a.archived).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label>Forma de pagamento</Label>
              <Select
                value={draft.payment_method}
                onValueChange={(v) => setDraft({ ...draft, payment_method: v })}
              >
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Observações</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveExpense} disabled={saving}>
              {saving ? "Salvando..." : "Salvar lançamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!reversing} onOpenChange={(o) => !o && setReversing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Nada é apagado: será criado um lançamento de sinal contrário e o original ficará
              bloqueado para edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverse}>Confirmar estorno</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonalExpensesPanel;
