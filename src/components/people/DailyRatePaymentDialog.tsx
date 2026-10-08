import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { AlertTriangle, Loader2, Receipt, ShieldCheck, Upload, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { formatCurrency } from '@/lib/utils';
import { canViewFinancials, PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/lib/people';
import { buildPaymentMemo, canPayDailyRate, findDuplicatePayment } from '@/lib/dailyRates';
import { buildReceiptPath, resolveReceiptDisplayUrl, validateReceiptUpload } from '@/lib/storageUrls';

export interface PayableDailyRate {
  id: string;
  worker_name: string;
  date: string;
  event_id?: string | null;
  event_name?: string | null;
  amount?: number | null;
  overtime_amount?: number | null;
  food_amount?: number | null;
  transport_amount?: number | null;
  lodging_amount?: number | null;
  discount_amount?: number | null;
  attendance_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  receipt_url?: string | null;
  bank_account_id?: string | null;
}

interface BankAccount {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: PayableDailyRate | null;
  /** Vales/adiantamentos já concedidos e ainda não descontados. */
  advances?: number;
  onPaid?: () => void;
}

const PAYMENT_METHODS = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Outro'];

/**
 * Pagamento da diária com memória de cálculo.
 * Não duplica lançamentos: valida referência e assinatura (conta+data+valor)
 * antes de gravar a transação bancária.
 */
export const DailyRatePaymentDialog = ({ open, onOpenChange, rate, advances = 0, onPaid }: Props) => {
  const { toast } = useToast();
  const { user, userRole } = useCustomAuth();
  const allowed = canViewFinancials(userRole);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('none');
  const [method, setMethod] = useState<string>('PIX');
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<PaymentStatus>('pago');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const memo = useMemo(
    () => buildPaymentMemo({ ...(rate ?? {}), advances }),
    [rate, advances]
  );

  const gate = useMemo(
    () =>
      canPayDailyRate({
        payment_status: rate?.payment_status,
        attendance_status: rate?.attendance_status,
        net: memo.breakdown.net,
      }),
    [rate, memo]
  );

  useEffect(() => {
    if (!open) return;
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setStatus('pago');
    setReceipt(null);
    setDuplicateWarning(null);
    setMethod(rate?.payment_method || 'PIX');
    setAccountId(rate?.bank_account_id || 'none');

    void (async () => {
      const { data, error } = await supabase.from('bank_accounts').select('id, name').order('name');
      if (!error) setAccounts((data ?? []) as BankAccount[]);
    })();
  }, [open, rate]);

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receipt || !rate) return rate?.receipt_url ?? null;
    const validation = validateReceiptUpload(receipt);
    if (!validation.ok) throw new Error(validation.error);
    const path = buildReceiptPath(user?.id ?? 'anon', receipt.name);
    const { error } = await supabase.storage
      .from('worker-receipts')
      .upload(path, receipt, { contentType: receipt.type });
    if (error) throw error;
    // Bucket privado: guardamos o caminho; a exibição usa URL assinada.
    return path;
  };

  const openReceipt = async (stored: string | null | undefined) => {
    const url = await resolveReceiptDisplayUrl(stored);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const startPayment = async () => {
    if (!rate) return;
    setDuplicateWarning(null);

    const { data: existing } = await supabase
      .from('bank_transactions')
      .select('id, reference_type, reference_id, amount, transaction_date, bank_account_id')
      .or(`reference_id.eq.${rate.id},transaction_date.eq.${paymentDate}`);

    const duplicate = findDuplicatePayment(
      {
        dailyRateId: rate.id,
        amount: memo.breakdown.net,
        date: paymentDate,
        bank_account_id: accountId === 'none' ? null : accountId,
      },
      (existing ?? []) as never[]
    );

    if (duplicate) {
      setDuplicateWarning(
        'Já existe um lançamento financeiro compatível (mesma referência ou mesma conta, data e valor). O pagamento será registrado sem duplicar a transação.'
      );
    }
    setConfirmOpen(true);
  };

  const confirmPayment = async () => {
    if (!rate || saving) return;
    setSaving(true);
    try {
      const receiptUrl = await uploadReceipt();

      const { error: updateError } = await supabase
        .from('daily_rates')
        .update({
          payment_status: status,
          payment_method: method,
          receipt_url: receiptUrl,
          bank_account_id: accountId === 'none' ? null : accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rate.id);
      if (updateError) throw updateError;

      if (status === 'pago' && accountId !== 'none') {
        const { data: existing } = await supabase
          .from('bank_transactions')
          .select('id, reference_type, reference_id, amount, transaction_date, bank_account_id')
          .eq('bank_account_id', accountId)
          .eq('transaction_date', paymentDate);

        const alreadyThere = findDuplicatePayment(
          {
            dailyRateId: rate.id,
            amount: memo.breakdown.net,
            date: paymentDate,
            bank_account_id: accountId,
          },
          (existing ?? []) as never[]
        );

        if (!alreadyThere) {
          const { error: txError } = await supabase.from('bank_transactions').insert({
            bank_account_id: accountId,
            transaction_type: 'expense',
            amount: memo.breakdown.net,
            description: `Diária - ${rate.worker_name}${rate.event_name ? ` (${rate.event_name})` : ''}`,
            transaction_date: paymentDate,
            category: 'Diárias',
            reference_type: 'daily_rate',
            reference_id: rate.id,
          });
          if (txError) throw txError;
        }
      }

      toast({
        title: 'Pagamento registrado',
        description: `${PAYMENT_STATUS_LABELS[status]} · ${formatCurrency(memo.breakdown.net)}`,
      });
      setConfirmOpen(false);
      onOpenChange(false);
      onPaid?.();
    } catch (error) {
      console.error('Erro ao registrar pagamento da diária:', error);
      toast({
        title: 'Erro ao registrar pagamento',
        description: 'Nada foi duplicado. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Acesso restrito</DialogTitle>
            <DialogDescription>
              Apenas administradores e o financeiro podem registrar pagamentos.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              Pagamento da diária
            </DialogTitle>
            <DialogDescription>
              {rate?.worker_name} ·{' '}
              {rate && format(new Date(`${rate.date}T12:00:00`), 'dd/MM/yyyy')}
              {rate?.event_name ? ` · ${rate.event_name}` : ''}
            </DialogDescription>
          </DialogHeader>

          <section aria-label="Memória de cálculo" className="rounded-lg border p-3">
            <h3 className="text-sm font-medium mb-2">Memória de cálculo</h3>
            <dl className="space-y-1 text-sm">
              {memo.lines.map((line) => (
                <div key={line.label} className="flex justify-between gap-4">
                  <dt
                    className={
                      line.kind === 'total'
                        ? 'font-semibold'
                        : line.kind === 'deduction'
                          ? 'text-muted-foreground'
                          : ''
                    }
                  >
                    {line.label}
                  </dt>
                  <dd
                    className={
                      line.kind === 'total'
                        ? 'font-semibold'
                        : line.kind === 'deduction'
                          ? 'text-destructive'
                          : ''
                    }
                  >
                    {line.kind === 'deduction' ? '- ' : ''}
                    {formatCurrency(line.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Bruto {formatCurrency(memo.breakdown.gross)} · Deduções{' '}
              {formatCurrency(memo.breakdown.deductions)}
            </p>
          </section>

          {!gate.allowed && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Pagamento indisponível</AlertTitle>
              <AlertDescription>{gate.reason}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                <SelectTrigger id="payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">Data do pagamento</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-account">Conta bancária</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="payment-account">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lançamento bancário</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-receipt" className="flex items-center gap-1">
              <Receipt className="h-4 w-4" aria-hidden="true" /> Comprovante (opcional)
            </Label>
            <Input
              id="payment-receipt"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
            {rate?.receipt_url && !receipt && (
              <button
                type="button"
                onClick={() => void openReceipt(rate.receipt_url)}
                className="text-xs underline text-muted-foreground text-left"
              >
                Ver comprovante já anexado
              </button>
            )}
          </div>

          {duplicateWarning && (
            <Alert>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{duplicateWarning}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="sm:flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="sm:flex-1"
              onClick={startPayment}
              disabled={saving || (status === 'pago' && !gate.allowed)}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Registrar {formatCurrency(memo.breakdown.net)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {rate?.worker_name} · {formatCurrency(memo.breakdown.net)} ·{' '}
                  {PAYMENT_STATUS_LABELS[status]} · {method}
                </p>
                <p className="text-muted-foreground">
                  Data {format(new Date(`${paymentDate}T12:00:00`), 'dd/MM/yyyy')}
                  {accountId === 'none'
                    ? ' · sem lançamento bancário'
                    : ` · ${accounts.find((a) => a.id === accountId)?.name ?? ''}`}
                </p>
                {duplicateWarning && (
                  <Badge variant="outline" className="whitespace-normal text-left">
                    {duplicateWarning}
                  </Badge>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayment} disabled={saving}>
              {saving ? 'Registrando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DailyRatePaymentDialog;
