import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { formatCurrency } from '@/lib/utils';
import { canViewFinancials, PAYMENT_STATUS_LABELS } from '@/lib/people';
import { listPendingPayments, summarizeCosts, type ReportRate } from '@/lib/dailyRates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Relatórios de custo e pendências construídos apenas com dados reais de `daily_rates`. */
export const DailyRateReportsDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const { userRole } = useCustomAuth();
  const showValues = canViewFinancials(userRole);

  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ReportRate[]>([]);
  const [start, setStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const fetchRates = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_rates')
        .select(
          'id, worker_id, worker_name, event_id, event_role, date, amount, overtime_amount, food_amount, transport_amount, lodging_amount, discount_amount, attendance_status, payment_status, planned_start_time, planned_end_time, actual_start_time, actual_end_time, events(name)'
        )
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });

      if (error) throw error;

      setRates(
        ((data ?? []) as unknown as Array<
          ReportRate & { events?: { name: string } | { name: string }[] | null }
        >).map((row) => {
          const ev = Array.isArray(row.events) ? row.events[0] : row.events;
          return { ...row, event_name: ev?.name ?? null };
        })
      );
    } catch (error) {
      console.error('Erro ao carregar relatórios de diárias:', error);
      toast({
        title: 'Erro ao carregar relatórios',
        description: 'Não foi possível ler os lançamentos do período.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [open, start, end, toast]);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const byEvent = useMemo(() => summarizeCosts(rates, 'event'), [rates]);
  const byPerson = useMemo(() => summarizeCosts(rates, 'person'), [rates]);
  const byRole = useMemo(() => summarizeCosts(rates, 'role'), [rates]);
  const pending = useMemo(() => listPendingPayments(rates), [rates]);

  const money = (value: number) => (showValues ? formatCurrency(value) : '•••');

  const renderGroups = (groups: ReturnType<typeof summarizeCosts>, label: string) =>
    groups.length === 0 ? (
      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>Nenhum lançamento no período selecionado.</AlertDescription>
      </Alert>
    ) : (
      <>
        {/* Desktop */}
        <div className="hidden md:block">
          <Table>
            <caption className="sr-only">Custo por {label}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{label}</TableHead>
                <TableHead className="text-right">Diárias</TableHead>
                <TableHead className="text-right">Faltas</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Deduções</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.key}>
                  <TableCell className="font-medium">{g.label}</TableCell>
                  <TableCell className="text-right">{g.days}</TableCell>
                  <TableCell className="text-right">{g.absences}</TableCell>
                  <TableCell className="text-right">{g.hours}</TableCell>
                  <TableCell className="text-right">{money(g.gross)}</TableCell>
                  <TableCell className="text-right text-destructive">{money(g.deductions)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(g.net)}</TableCell>
                  <TableCell className="text-right">{money(g.pending)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-2">
          {groups.map((g) => (
            <div key={g.key} className="rounded-lg border p-3 space-y-1">
              <p className="font-medium">{g.label}</p>
              <p className="text-xs text-muted-foreground">
                {g.days} diária(s) · {g.absences} falta(s) · {g.hours}h
              </p>
              <p className="text-sm">Líquido: {money(g.net)}</p>
              <p className="text-xs text-muted-foreground">Em aberto: {money(g.pending)}</p>
            </div>
          ))}
        </div>
      </>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Relatórios de diárias
          </DialogTitle>
          <DialogDescription>
            Custos e pendências calculados a partir dos lançamentos existentes no período.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="report-start">De</Label>
            <Input id="report-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-end">Até</Label>
            <Input id="report-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="event">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="event">Evento</TabsTrigger>
              <TabsTrigger value="person">Profissional</TabsTrigger>
              <TabsTrigger value="role">Função</TabsTrigger>
              <TabsTrigger value="pending">
                Pendentes
                {pending.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="event" className="mt-4">
              {renderGroups(byEvent, 'Evento')}
            </TabsContent>
            <TabsContent value="person" className="mt-4">
              {renderGroups(byPerson, 'Profissional')}
            </TabsContent>
            <TabsContent value="role" className="mt-4">
              {renderGroups(byRole, 'Função')}
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
              {pending.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>Nenhum pagamento em aberto no período.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Total em aberto:{' '}
                    <strong>{money(pending.reduce((sum, p) => sum + p.net, 0))}</strong>
                  </p>
                  <div className="hidden md:block">
                    <Table>
                      <caption className="sr-only">Pagamentos pendentes</caption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Profissional</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pending.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{format(new Date(`${p.date}T12:00:00`), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="font-medium">{p.worker_name}</TableCell>
                            <TableCell>{p.event_name ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{PAYMENT_STATUS_LABELS[p.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{money(p.net)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="md:hidden space-y-2">
                    {pending.map((p) => (
                      <div key={p.id} className="rounded-lg border p-3">
                        <p className="font-medium">{p.worker_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(`${p.date}T12:00:00`), 'dd/MM/yyyy')} · {p.event_name ?? 'Sem evento'}
                        </p>
                        <p className="text-sm">{money(p.net)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyRateReportsDialog;
