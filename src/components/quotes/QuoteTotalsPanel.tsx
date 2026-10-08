import { Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { QuoteTotals, TaxOption } from '@/lib/quotes';

interface QuoteTotalsPanelProps {
  totals: QuoteTotals;
  discountPercentage: number;
  travelExpense: number;
  accommodationExpense: number;
  taxOption: TaxOption;
  taxPercentage: number;
  canViewValues?: boolean;
  variant?: 'sidebar' | 'bar';
  className?: string;
}

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export function QuoteTotalsPanel({
  totals,
  discountPercentage,
  travelExpense,
  accommodationExpense,
  taxOption,
  taxPercentage,
  canViewValues = true,
  variant = 'sidebar',
  className,
}: QuoteTotalsPanelProps) {
  const show = (value: number) => (canViewValues ? brl(value) : '---');

  if (variant === 'bar') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 shadow-lg',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total do orçamento</p>
          <p className="truncate text-lg font-bold text-primary">{show(totals.total_amount)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Subtotal: {show(totals.subtotal)}</p>
          {totals.discount_amount > 0 && <p>Desconto: -{show(totals.discount_amount)}</p>}
          {totals.tax_amount > 0 && <p>Imposto: {show(totals.tax_amount)}</p>}
        </div>
      </div>
    );
  }

  return (
    <aside className={cn('rounded-lg border border-border bg-card p-4', className)} aria-label="Resumo financeiro">
      <h4 className="mb-3 text-sm font-semibold">Resumo financeiro</h4>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium">{show(totals.subtotal)}</dd>
        </div>

        {discountPercentage > 0 && (
          <div className="flex justify-between text-destructive">
            <dt>Desconto ({discountPercentage}%)</dt>
            <dd>-{show(totals.discount_amount)}</dd>
          </div>
        )}

        {travelExpense > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Viagem</dt>
            <dd className="font-medium">{show(travelExpense)}</dd>
          </div>
        )}

        {accommodationExpense > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hospedagem</dt>
            <dd className="font-medium">{show(accommodationExpense)}</dd>
          </div>
        )}

        {taxOption === 'com_nota' && (
          <div className="flex justify-between">
            <dt className="flex items-center gap-1 text-muted-foreground">
              Imposto ({taxPercentage}%)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Como o imposto é calculado">
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Imposto calculado por dentro: (subtotal - desconto) x alíquota / (1 - alíquota), para que o valor
                      líquido dos serviços seja preservado após a emissão da nota.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </dt>
            <dd className="font-medium">{show(totals.tax_amount)}</dd>
          </div>
        )}

        <Separator />

        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">Total</dt>
          <dd className="text-xl font-bold text-primary">{show(totals.total_amount)}</dd>
        </div>
      </dl>
    </aside>
  );
}

export default QuoteTotalsPanel;
