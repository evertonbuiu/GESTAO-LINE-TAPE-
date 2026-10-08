import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarDays, CheckCircle2, CircleSlash, Info, Loader2, Search, Trash2 } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import {
  AVAILABILITY_PERIODS,
  PERIOD_LABELS,
  canManageSchedule,
  normalizePersonStatus,
  isSchedulable,
  type AvailabilityPeriod,
  type AvailabilityValue,
} from '@/lib/people';

interface WorkerRow {
  id: string;
  name: string;
  status: string | null;
  primary_role: string | null;
}

interface AvailabilityRow {
  id: string;
  worker_id: string | null;
  worker_name: string | null;
  availability_date: string;
  period: string;
  availability: string;
  notes: string | null;
}

const AVAILABILITY_VALUES: AvailabilityValue[] = ['disponivel', 'parcial', 'indisponivel'];

const AVAILABILITY_LABELS: Record<AvailabilityValue, string> = {
  disponivel: 'Disponível',
  parcial: 'Parcial',
  indisponivel: 'Indisponível',
};

const AVAILABILITY_STYLES: Record<AvailabilityValue, string> = {
  disponivel: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  parcial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  indisponivel: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const toKey = (workerId: string, date: string, period: string) => `${workerId}|${date}|${period}`;

interface WorkerAvailabilityBoardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona um diarista pelo nome (visão individual). */
  initialWorkerName?: string | null;
}

/**
 * Disponibilidade de diaristas por data e período.
 * Leitura para perfis internos; edição conforme RLS (admin/financeiro/funcionário).
 */
export const WorkerAvailabilityBoard = ({
  open,
  onOpenChange,
  initialWorkerName,
}: WorkerAvailabilityBoardProps) => {
  const { toast } = useToast();
  const { user, userRole } = useCustomAuth();
  const canEdit = canManageSchedule(userRole);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('escalaveis');
  const [period, setPeriod] = useState<AvailabilityPeriod>('integral');
  const [startDate, setStartDate] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [days, setDays] = useState(7);
  const [pendingDelete, setPendingDelete] = useState<AvailabilityRow | null>(null);

  const dateList = useMemo(() => {
    const base = new Date(`${startDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return [];
    return Array.from({ length: days }, (_, i) => format(addDays(base, i), 'yyyy-MM-dd'));
  }, [startDate, days]);

  const fetchData = useCallback(async () => {
    if (!open || dateList.length === 0) return;
    setLoading(true);
    try {
      const [workersRes, availabilityRes] = await Promise.all([
        supabase
          .from('workers')
          .select('id, name, status, primary_role')
          .order('name', { ascending: true }),
        supabase
          .from('worker_availability')
          .select('id, worker_id, worker_name, availability_date, period, availability, notes')
          .gte('availability_date', dateList[0])
          .lte('availability_date', dateList[dateList.length - 1]),
      ]);

      if (workersRes.error) throw workersRes.error;
      if (availabilityRes.error) throw availabilityRes.error;

      // Deduplica o cadastro legado (uma linha por diarista por mês): mantém o registro mais recente por nome.
      const unique = new Map<string, WorkerRow>();
      for (const w of (workersRes.data ?? []) as WorkerRow[]) {
        unique.set(w.name.trim().toLowerCase(), w);
      }

      setWorkers(Array.from(unique.values()));
      setRows((availabilityRes.data ?? []) as AvailabilityRow[]);
    } catch (error) {
      console.error('Erro ao carregar disponibilidade:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a disponibilidade.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [open, dateList, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (open && initialWorkerName) setSearch(initialWorkerName);
  }, [open, initialWorkerName]);

  const roles = useMemo(
    () => Array.from(new Set(workers.map((w) => w.primary_role).filter(Boolean))) as string[],
    [workers]
  );

  const visibleWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workers.filter((w) => {
      if (term && !w.name.toLowerCase().includes(term)) return false;
      if (roleFilter !== 'all' && (w.primary_role ?? '') !== roleFilter) return false;
      if (statusFilter === 'escalaveis' && !isSchedulable(w.status)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'escalaveis') {
        return normalizePersonStatus(w.status) === statusFilter;
      }
      return true;
    });
  }, [workers, search, roleFilter, statusFilter]);

  const index = useMemo(() => {
    const map = new Map<string, AvailabilityRow>();
    for (const row of rows) {
      if (row.period !== period) continue;
      const workerId =
        row.worker_id ??
        workers.find((w) => w.name.trim().toLowerCase() === (row.worker_name ?? '').trim().toLowerCase())?.id;
      if (!workerId) continue;
      map.set(toKey(workerId, row.availability_date, row.period), row);
    }
    return map;
  }, [rows, period, workers]);

  const cycleValue = (current?: AvailabilityValue): AvailabilityValue => {
    if (!current) return 'disponivel';
    const next = AVAILABILITY_VALUES[(AVAILABILITY_VALUES.indexOf(current) + 1) % AVAILABILITY_VALUES.length];
    return next;
  };

  const handleToggle = async (worker: WorkerRow, date: string) => {
    if (!canEdit) return;
    const key = toKey(worker.id, date, period);
    const existing = index.get(key);
    const nextValue = cycleValue(existing?.availability as AvailabilityValue | undefined);
    setSaving(key);
    try {
      if (existing) {
        const { error } = await supabase
          .from('worker_availability')
          .update({ availability: nextValue, worker_id: worker.id, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        setRows((prev) =>
          prev.map((r) => (r.id === existing.id ? { ...r, availability: nextValue, worker_id: worker.id } : r))
        );
      } else {
        const { data, error } = await supabase
          .from('worker_availability')
          .insert({
            worker_id: worker.id,
            worker_name: worker.name,
            availability_date: date,
            period,
            availability: nextValue,
            created_by: user?.id ?? null,
          })
          .select('id, worker_id, worker_name, availability_date, period, availability, notes')
          .single();
        if (error) throw error;
        setRows((prev) => [...prev, data as AvailabilityRow]);
      }
    } catch (error) {
      console.error('Erro ao salvar disponibilidade:', error);
      toast({
        title: 'Não foi possível salvar',
        description: 'Verifique suas permissões e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const { error } = await supabase.from('worker_availability').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      toast({ title: 'Registro removido', description: 'A marcação foi apagada.' });
    } catch (error) {
      console.error('Erro ao remover disponibilidade:', error);
      toast({ title: 'Erro ao remover', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setPendingDelete(null);
    }
  };

  const summary = useMemo(() => {
    let available = 0;
    let unavailable = 0;
    for (const row of index.values()) {
      if (row.availability === 'indisponivel') unavailable += 1;
      else available += 1;
    }
    return { available, unavailable };
  }, [index]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              Disponibilidade de diaristas
            </DialogTitle>
            <DialogDescription>
              Marque por data e período. {canEdit ? 'Clique na célula para alternar entre disponível, parcial e indisponível.' : 'Somente leitura para o seu perfil.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="availability-search">Buscar diarista</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="availability-search"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability-start">Início</Label>
              <Input
                id="availability-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability-days">Período exibido</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger id="availability-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability-period">Turno</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as AvailabilityPeriod)}>
                <SelectTrigger id="availability-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability-role">Função</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="availability-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability-status">Situação</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="availability-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escalaveis">Escaláveis</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {summary.available} marcações disponíveis/parciais
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CircleSlash className="h-3 w-3" aria-hidden="true" /> {summary.unavailable} indisponíveis
            </Badge>
          </div>

          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : visibleWorkers.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Nenhum diarista encontrado com os filtros atuais.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Desktop: grade por data */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">Disponibilidade por diarista e data</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 bg-background text-left p-2 min-w-[180px]">
                        Diarista
                      </th>
                      {dateList.map((d) => (
                        <th key={d} scope="col" className="p-2 text-center whitespace-nowrap">
                          {format(new Date(`${d}T12:00:00`), 'dd/MM EEE', { locale: ptBR })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWorkers.map((worker) => (
                      <tr key={worker.id} className="border-t">
                        <th scope="row" className="sticky left-0 bg-background text-left p-2 font-medium">
                          {worker.name}
                          {worker.primary_role && (
                            <span className="block text-xs text-muted-foreground">{worker.primary_role}</span>
                          )}
                        </th>
                        {dateList.map((d) => {
                          const key = toKey(worker.id, d, period);
                          const row = index.get(key);
                          const value = (row?.availability as AvailabilityValue) ?? undefined;
                          return (
                            <td key={d} className="p-1 text-center">
                              <button
                                type="button"
                                disabled={!canEdit || saving === key}
                                onClick={() => handleToggle(worker, d)}
                                aria-label={`${worker.name} em ${format(new Date(`${d}T12:00:00`), 'dd/MM/yyyy')}: ${value ? AVAILABILITY_LABELS[value] : 'sem marcação'}`}
                                className={`w-full rounded px-2 py-1 text-xs transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  value ? AVAILABILITY_STYLES[value] : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {saving === key ? (
                                  <Loader2 className="mx-auto h-3 w-3 animate-spin" aria-hidden="true" />
                                ) : value ? (
                                  AVAILABILITY_LABELS[value].slice(0, 4)
                                ) : (
                                  '—'
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards por diarista */}
              <div className="md:hidden space-y-3">
                {visibleWorkers.map((worker) => (
                  <div key={worker.id} className="rounded-lg border p-3">
                    <p className="font-medium">{worker.name}</p>
                    {worker.primary_role && (
                      <p className="text-xs text-muted-foreground">{worker.primary_role}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dateList.map((d) => {
                        const key = toKey(worker.id, d, period);
                        const row = index.get(key);
                        const value = (row?.availability as AvailabilityValue) ?? undefined;
                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={!canEdit || saving === key}
                            onClick={() => handleToggle(worker, d)}
                            aria-label={`${worker.name} em ${format(new Date(`${d}T12:00:00`), 'dd/MM/yyyy')}: ${value ? AVAILABILITY_LABELS[value] : 'sem marcação'}`}
                            className={`rounded px-2 py-1 text-xs ${
                              value ? AVAILABILITY_STYLES[value] : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {format(new Date(`${d}T12:00:00`), 'dd/MM')}
                          </button>
                        );
                      })}
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dateList
                          .map((d) => index.get(toKey(worker.id, d, period)))
                          .filter((r): r is AvailabilityRow => !!r)
                          .map((r) => (
                            <Button
                              key={r.id}
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDelete(r)}
                              aria-label={`Remover marcação de ${format(new Date(`${r.availability_date}T12:00:00`), 'dd/MM')}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                              {format(new Date(`${r.availability_date}T12:00:00`), 'dd/MM')}
                            </Button>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover marcação?</AlertDialogTitle>
            <AlertDialogDescription>
              A disponibilidade de {pendingDelete?.worker_name} em{' '}
              {pendingDelete && format(new Date(`${pendingDelete.availability_date}T12:00:00`), 'dd/MM/yyyy')} será apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WorkerAvailabilityBoard;
