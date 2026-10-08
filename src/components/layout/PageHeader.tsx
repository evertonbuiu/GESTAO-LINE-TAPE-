// Cabeçalho padrão das páginas.
//
// O título, a descrição e o ícone vêm do mapa de navegação e são desenhados
// pela estrutura principal (AppShell), sempre iguais em todas as telas.
// Cada tela coloca seus botões de ação no cabeçalho com <PageActions>.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const ActionsSlotContext = createContext<HTMLElement | null>(null);

export function ActionsSlotProvider({ target, children }: { target: HTMLElement | null; children: ReactNode }) {
  return <ActionsSlotContext.Provider value={target}>{children}</ActionsSlotContext.Provider>;
}

/** Botões que aparecem à direita do título da página. */
export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  const target = useContext(ActionsSlotContext);
  // Grupos internos também quebram linha, para nada ficar fora da tela.
  const content = (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>div]:flex-wrap [&>div]:max-w-full [&_label]:whitespace-nowrap",
        className,
      )}
    >
      {children}
    </div>
  );
  if (!target) return content;
  return createPortal(content, target);
}

interface PageHeaderProps {
  icon?: LucideIcon;
  group?: string | null;
  title: string;
  description?: string;
  /** Elemento onde as telas colocam os botões (PageActions). */
  onActionsSlot?: (el: HTMLElement | null) => void;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, group, title, description, onActionsSlot, actions, className }: PageHeaderProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    onActionsSlot?.(slot);
  }, [slot, onActionsSlot]);

  return (
    <div className={cn("border-b border-border bg-card/40 px-4 py-5 sm:px-6", className)}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-sidebar-primary/15 dark:text-sidebar-primary dark:ring-sidebar-primary/25">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            {group && <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group}</p>}
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div ref={setSlot} className="flex min-w-0 max-w-full flex-wrap items-center gap-2 empty:hidden lg:shrink-0">
          {actions}
        </div>
      </div>
    </div>
  );
}

/** Bloco de conteúdo com título opcional, no padrão visual das páginas. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Indicador numérico (cartão de resumo). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-primary bg-primary/10 dark:text-sidebar-primary dark:bg-sidebar-primary/15",
    success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    danger: "text-red-600 bg-red-500/10 dark:text-red-400",
    info: "text-sky-600 bg-sky-500/10 dark:text-sky-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
