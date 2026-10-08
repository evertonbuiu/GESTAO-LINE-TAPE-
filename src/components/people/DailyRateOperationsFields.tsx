import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock } from 'lucide-react';
import { ATTENDANCE_STATUSES, ATTENDANCE_LABELS, type AttendanceStatus } from '@/lib/people';
import { durationInHours, overtimeHours, validateAttendance } from '@/lib/dailyRates';

export interface DailyRateOperationsValue {
  event_role: string;
  attendance_status: AttendanceStatus;
  substituted_worker_name: string;
  planned_start_time: string;
  planned_end_time: string;
  actual_start_time: string;
  actual_end_time: string;
  overtime_amount: number;
  food_amount: number;
  transport_amount: number;
  lodging_amount: number;
  discount_amount: number;
}

export const emptyOperations = (): DailyRateOperationsValue => ({
  event_role: '',
  attendance_status: 'prevista',
  substituted_worker_name: '',
  planned_start_time: '',
  planned_end_time: '',
  actual_start_time: '',
  actual_end_time: '',
  overtime_amount: 0,
  food_amount: 0,
  transport_amount: 0,
  lodging_amount: 0,
  discount_amount: 0,
});

interface Props {
  value: DailyRateOperationsValue;
  onChange: (next: DailyRateOperationsValue) => void;
  /** Adicionais e descontos só para perfis financeiros. */
  canEditFinancials?: boolean;
  disabled?: boolean;
}

/**
 * Campos operacionais da diária: função, presença, substituição,
 * horários previsto/real e adicionais/descontos.
 */
export const DailyRateOperationsFields = ({
  value,
  onChange,
  canEditFinancials = true,
  disabled = false,
}: Props) => {
  const set = <K extends keyof DailyRateOperationsValue>(
    key: K,
    next: DailyRateOperationsValue[K]
  ) => onChange({ ...value, [key]: next });

  const plannedHours = durationInHours(value.planned_start_time, value.planned_end_time);
  const actualHours = durationInHours(value.actual_start_time, value.actual_end_time);
  const extra = overtimeHours(value);
  const errors = validateAttendance(value);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event_role">Função no evento</Label>
          <Input
            id="event_role"
            value={value.event_role}
            disabled={disabled}
            onChange={(e) => set('event_role', e.target.value)}
            placeholder="Ex.: Montagem, Operação, Carga"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance_status">Presença</Label>
          <Select
            value={value.attendance_status}
            disabled={disabled}
            onValueChange={(v) => set('attendance_status', v as AttendanceStatus)}
          >
            <SelectTrigger id="attendance_status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ATTENDANCE_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.attendance_status === 'substituido' && (
        <div className="space-y-2">
          <Label htmlFor="substituted_worker_name">Substituiu quem? *</Label>
          <Input
            id="substituted_worker_name"
            value={value.substituted_worker_name}
            disabled={disabled}
            onChange={(e) => set('substituted_worker_name', e.target.value)}
            placeholder="Nome do diarista substituído"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="planned_start_time">Início previsto</Label>
          <Input
            id="planned_start_time"
            type="time"
            value={value.planned_start_time}
            disabled={disabled}
            onChange={(e) => set('planned_start_time', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planned_end_time">Fim previsto</Label>
          <Input
            id="planned_end_time"
            type="time"
            value={value.planned_end_time}
            disabled={disabled}
            onChange={(e) => set('planned_end_time', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_start_time">Início real</Label>
          <Input
            id="actual_start_time"
            type="time"
            value={value.actual_start_time}
            disabled={disabled || value.attendance_status === 'falta'}
            onChange={(e) => set('actual_start_time', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_end_time">Fim real</Label>
          <Input
            id="actual_end_time"
            type="time"
            value={value.actual_end_time}
            disabled={disabled || value.attendance_status === 'falta'}
            onChange={(e) => set('actual_end_time', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {plannedHours !== null && (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" /> Previsto: {plannedHours}h
          </Badge>
        )}
        {actualHours !== null && (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" /> Real: {actualHours}h
          </Badge>
        )}
        {extra > 0 && <Badge variant="secondary">Excedente: {extra}h</Badge>}
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {canEditFinancials && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="overtime_amount">Hora extra (R$)</Label>
            <CurrencyInput
              id="overtime_amount"
              value={value.overtime_amount}
              disabled={disabled}
              onChange={(v) => set('overtime_amount', v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="food_amount">Alimentação (R$)</Label>
            <CurrencyInput
              id="food_amount"
              value={value.food_amount}
              disabled={disabled}
              onChange={(v) => set('food_amount', v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transport_amount">Transporte (R$)</Label>
            <CurrencyInput
              id="transport_amount"
              value={value.transport_amount}
              disabled={disabled}
              onChange={(v) => set('transport_amount', v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lodging_amount">Hospedagem (R$)</Label>
            <CurrencyInput
              id="lodging_amount"
              value={value.lodging_amount}
              disabled={disabled}
              onChange={(v) => set('lodging_amount', v)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="discount_amount">Desconto (R$)</Label>
            <CurrencyInput
              id="discount_amount"
              value={value.discount_amount}
              disabled={disabled}
              onChange={(v) => set('discount_amount', v)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyRateOperationsFields;
