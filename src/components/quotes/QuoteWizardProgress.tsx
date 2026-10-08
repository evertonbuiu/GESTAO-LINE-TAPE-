import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: 1 | 2 | 3;
  title: string;
  description: string;
}

export const QUOTE_WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: 'Cliente e Evento', description: 'Dados do cliente e do evento' },
  { id: 2, title: 'Equipamentos e Serviços', description: 'Itens do orçamento' },
  { id: 3, title: 'Valores e Revisão', description: 'Descontos, impostos e revisão' },
];

interface QuoteWizardProgressProps {
  currentStep: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  maxReachedStep: 1 | 2 | 3;
}

export function QuoteWizardProgress({ currentStep, onStepChange, maxReachedStep }: QuoteWizardProgressProps) {
  return (
    <nav aria-label="Etapas do orçamento" className="mb-4">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {QUOTE_WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = step.id < currentStep;
          const isEnabled = step.id <= maxReachedStep;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!isEnabled}
                onClick={() => isEnabled && onStepChange(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors min-h-11',
                  isActive && 'border-primary bg-primary/10',
                  !isActive && isDone && 'border-primary/40 bg-primary/5',
                  !isActive && !isDone && 'border-border bg-card',
                  !isEnabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isActive || isDone ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {step.id}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{step.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{step.description}</span>
                </span>
              </button>
              {index < QUOTE_WIZARD_STEPS.length - 1 && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default QuoteWizardProgress;
