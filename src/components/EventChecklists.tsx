import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

type Phase = "separacao" | "saida" | "devolucao";

const PHASES: Array<{ key: Phase; label: string; description: string }> = [
  { key: "separacao", label: "Separação", description: "Conferência dos itens no galpão" },
  { key: "saida", label: "Saída", description: "Carregamento e envio para o evento" },
  { key: "devolucao", label: "Devolução", description: "Retorno e conferência final" },
];

interface ChecklistItem {
  id: string;
  equipment_name: string;
  expected_quantity: number;
  checked_quantity: number;
  is_checked: boolean;
  notes: string | null;
}

interface Checklist {
  id: string;
  phase: string;
  status: string;
  responsible_name: string | null;
  performed_at: string | null;
  notes: string | null;
}

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const EventChecklists = () => {
  const { user, userRole } = useCustomAuth();
  const canEdit = userRole === "admin" || userRole === "deposito" || userRole === "financeiro";

  const [events, setEvents] = useState<Array<{ id: string; name: string; event_date: string }>>([]);
  const [eventId, setEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<Record<string, Checklist>>({});
  const [items, setItems] = useState<Record<string, ChecklistItem[]>>({});
  const [drafts, setDrafts] = useState<Record<string, { responsible: string; performedAt: string; notes: string }>>({});

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from("events")
        .select("id, name, event_date")
        .order("event_date", { ascending: false })
        .limit(100);
      if (err) setError("Não foi possível carregar os eventos.");
      setEvents(data ?? []);
      if (data && data.length > 0) setEventId(data[0].id);
      setLoading(false);
    })();
  }, []);

  const loadChecklists = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: lists, error: listError } = await supabase
        .from("event_checklists")
        .select("id, phase, status, responsible_name, performed_at, notes")
        .eq("event_id", id);
      if (listError) throw listError;

      const map: Record<string, Checklist> = {};
      (lists ?? []).forEach((l) => {
        map[l.phase] = l as Checklist;
      });
      setChecklists(map);

      const ids = (lists ?? []).map((l) => l.id);
      if (ids.length > 0) {
        const { data: rows, error: itemError } = await supabase
          .from("event_checklist_items")
          .select("id, checklist_id, equipment_name, expected_quantity, checked_quantity, is_checked, notes")
          .in("checklist_id", ids);
        if (itemError) throw itemError;
        const grouped: Record<string, ChecklistItem[]> = {};
        (rows ?? []).forEach((r) => {
          (grouped[r.checklist_id] ??= []).push(r as ChecklistItem);
        });
        Object.values(grouped).forEach((arr) =>
          arr.sort((a, b) => a.equipment_name.localeCompare(b.equipment_name)),
        );
        setItems(grouped);
      } else {
        setItems({});
      }
    } catch {
      setError("Não foi possível carregar os checklists deste evento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChecklists(eventId);
  }, [eventId, loadChecklists]);

  const createChecklist = async (phase: Phase) => {
    if (!eventId) return;
    setSaving(true);
    try {
      const { data: checklist, error: insertError } = await supabase
        .from("event_checklists")
        .insert({
          event_id: eventId,
          phase,
          status: "pendente",
          created_by: user?.id ?? null,
        })
        .select("id, phase, status, responsible_name, performed_at, notes")
        .single();
      if (insertError) throw insertError;

      const { data: equipment } = await supabase
        .from("event_equipment")
        .select("id, equipment_name, quantity")
        .eq("event_id", eventId);

      if (equipment && equipment.length > 0) {
        const { error: itemsError } = await supabase.from("event_checklist_items").insert(
          equipment.map((e) => ({
            checklist_id: checklist.id,
            equipment_name: e.equipment_name,
            expected_quantity: e.quantity ?? 0,
            checked_quantity: 0,
            is_checked: false,
          })),
        );
        if (itemsError) throw itemsError;
      }

      toast.success("Checklist criado.");
      await loadChecklists(eventId);
    } catch {
      toast.error("Não foi possível criar o checklist.");
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (checklistId: string, item: ChecklistItem, checked: boolean) => {
    setItems((prev) => ({
      ...prev,
      [checklistId]: (prev[checklistId] ?? []).map((i) =>
        i.id === item.id
          ? { ...i, is_checked: checked, checked_quantity: checked ? i.expected_quantity : 0 }
          : i,
      ),
    }));
    const { error: err } = await supabase
      .from("event_checklist_items")
      .update({
        is_checked: checked,
        checked_quantity: checked ? item.expected_quantity : 0,
      })
      .eq("id", item.id);
    if (err) toast.error("Não foi possível salvar o item.");
  };

  const updateItemQuantity = async (checklistId: string, item: ChecklistItem, qty: number) => {
    setItems((prev) => ({
      ...prev,
      [checklistId]: (prev[checklistId] ?? []).map((i) =>
        i.id === item.id ? { ...i, checked_quantity: qty } : i,
      ),
    }));
    await supabase.from("event_checklist_items").update({ checked_quantity: qty }).eq("id", item.id);
  };

  const saveChecklist = async (phase: Phase, status: "em_andamento" | "concluido") => {
    const checklist = checklists[phase];
    if (!checklist) return;
    const draft = drafts[phase];
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("event_checklists")
        .update({
          status,
          responsible_name: draft?.responsible ?? checklist.responsible_name,
          performed_at:
            draft?.performedAt ? new Date(draft.performedAt).toISOString() : checklist.performed_at ?? new Date().toISOString(),
          notes: draft?.notes ?? checklist.notes,
          responsible_user_id: user?.id ?? null,
        })
        .eq("id", checklist.id);
      if (err) throw err;
      toast.success(status === "concluido" ? "Checklist concluído." : "Checklist salvo.");
      await loadChecklists(eventId);
    } catch {
      toast.error("Não foi possível salvar o checklist.");
    } finally {
      setSaving(false);
    }
  };

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6" /> Checklists do evento
        </h1>
        <p className="text-sm text-muted-foreground">
          Separação, saída e devolução com responsável, data/hora e observações.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evento</CardTitle>
          <CardDescription>Selecione o evento para gerenciar os checklists.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {e.event_date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !selectedEvent ? (
        <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>
      ) : (
        <Tabs defaultValue="separacao">
          <TabsList>
            {PHASES.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>
                {p.label}
                {checklists[p.key]?.status === "concluido" && (
                  <CheckCircle2 className="ml-2 h-3.5 w-3.5 text-green-600" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {PHASES.map((phase) => {
            const checklist = checklists[phase.key];
            const list = checklist ? items[checklist.id] ?? [] : [];
            const draft = drafts[phase.key] ?? {
              responsible: checklist?.responsible_name ?? user?.name ?? "",
              performedAt: checklist?.performed_at
                ? new Date(checklist.performed_at).toISOString().slice(0, 16)
                : nowLocalInput(),
              notes: checklist?.notes ?? "",
            };
            const done = list.filter((i) => i.is_checked).length;

            return (
              <TabsContent key={phase.key} value={phase.key}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{phase.label}</CardTitle>
                        <CardDescription>{phase.description}</CardDescription>
                      </div>
                      {checklist ? (
                        <Badge variant={checklist.status === "concluido" ? "default" : "secondary"}>
                          {checklist.status === "concluido"
                            ? "Concluído"
                            : checklist.status === "em_andamento"
                              ? "Em andamento"
                              : "Pendente"}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!canEdit || saving}
                          onClick={() => void createChecklist(phase.key)}
                        >
                          Criar checklist
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {checklist && (
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Responsável</Label>
                          <Input
                            value={draft.responsible}
                            disabled={!canEdit}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [phase.key]: { ...draft, responsible: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Data e hora</Label>
                          <Input
                            type="datetime-local"
                            value={draft.performedAt}
                            disabled={!canEdit}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [phase.key]: { ...draft, performedAt: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label>Observações</Label>
                        <Textarea
                          rows={2}
                          value={draft.notes}
                          disabled={!canEdit}
                          onChange={(e) =>
                            setDrafts((p) => ({
                              ...p,
                              [phase.key]: { ...draft, notes: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Itens conferidos: {done}/{list.length}
                        </p>
                        {list.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum equipamento vinculado a este evento.
                          </p>
                        )}
                        {list.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded border border-border p-2"
                          >
                            <Checkbox
                              checked={item.is_checked}
                              disabled={!canEdit}
                              onCheckedChange={(v) =>
                                void toggleItem(checklist.id, item, v === true)
                              }
                            />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {item.equipment_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Previsto: {item.expected_quantity}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              className="w-24"
                              disabled={!canEdit}
                              value={item.checked_quantity}
                              onChange={(e) =>
                                void updateItemQuantity(
                                  checklist.id,
                                  item,
                                  Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled={!canEdit || saving}
                          onClick={() => void saveChecklist(phase.key, "em_andamento")}
                        >
                          Salvar
                        </Button>
                        <Button
                          disabled={!canEdit || saving}
                          onClick={() => void saveChecklist(phase.key, "concluido")}
                        >
                          Concluir {phase.label.toLowerCase()}
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
};
