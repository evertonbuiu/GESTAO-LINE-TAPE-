import { ReactNode, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Lock, TriangleAlert } from "lucide-react";
import {
  type Comparison,
  formatDelta,
  pageCount,
  paginate,
  searchRows,
  sortRows,
  type SortDirection,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- estados */

interface SectionStateProps {
  isLoading?: boolean;
  isError?: boolean;
  denied?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

export const SectionState = ({
  isLoading,
  isError,
  denied,
  isEmpty,
  emptyMessage = "Nenhum dado disponível para os filtros selecionados.",
  onRetry,
  children,
}: SectionStateProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Carregando dados do relatório…</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Lock className="h-8 w-8" aria-hidden="true" />
        <p className="font-medium text-foreground">Sem permissão para ver estes dados</p>
        <p className="text-sm">Solicite acesso a um administrador para consultar esta seção.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
        <TriangleAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="font-medium text-foreground">Não foi possível carregar o relatório</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Inbox className="h-8 w-8" aria-hidden="true" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
};

/* ------------------------------------------------------------------ KPIs */

interface KpiCardProps {
  label: string;
  value: string;
  comparison?: Comparison;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

export const KpiCard = ({ label, value, comparison, hint, tone = "default" }: KpiCardProps) => (
  <Card>
    <CardContent className="pt-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {comparison && (
        <p
          className={cn(
            "mt-1 text-xs",
            comparison.direction === "up" && "text-emerald-600 dark:text-emerald-400",
            comparison.direction === "down" && "text-destructive",
            comparison.direction === "flat" && "text-muted-foreground",
          )}
        >
          {formatDelta(comparison)}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

/* --------------------------------------------------------------- tabela */

export interface ReportColumn<T> {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface ReportTableProps<T extends { id: string }> {
  title: string;
  columns: Array<ReportColumn<T>>;
  rows: T[];
  searchFields: Array<keyof T>;
  initialSort: { field: keyof T & string; direction: SortDirection };
  onRowSelect?: (row: T) => void;
  actions?: ReactNode;
  pageSize?: number;
  emptyMessage?: string;
}

export function ReportTable<T extends { id: string }>({
  title,
  columns,
  rows,
  searchFields,
  initialSort,
  onRowSelect,
  actions,
  pageSize = 20,
  emptyMessage = "Nenhum registro encontrado.",
}: ReportTableProps<T>) {
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const processed = useMemo(() => {
    const found = searchRows(rows, term, searchFields);
    return sortRows(found, sort.field as keyof T, sort.direction);
  }, [rows, term, searchFields, sort]);

  const totalPages = pageCount(processed.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const visible = paginate(processed, currentPage, pageSize);

  const toggleSort = (field: keyof T & string) => {
    setPage(1);
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">
          {title} <span className="text-muted-foreground">({processed.length})</span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar…"
            aria-label={`Buscar em ${title}`}
            className="h-9 w-full sm:w-56"
          />
          {actions}
        </div>
      </CardHeader>
      <CardContent>
        {processed.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <caption className="sr-only">{title}</caption>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => {
                      const active = sort.field === col.key;
                      const sortable = col.sortable !== false;
                      return (
                        <TableHead
                          key={col.key}
                          className={cn(col.numeric && "text-right", col.className)}
                          aria-sort={
                            active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                          }
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {col.label}
                              {active ? (
                                sort.direction === "asc" ? (
                                  <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            col.label
                          )}
                        </TableHead>
                      );
                    })}
                    {onRowSelect && <TableHead className="w-20 text-right">Detalhes</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(col.numeric && "text-right tabular-nums", col.className)}
                        >
                          {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                        </TableCell>
                      ))}
                      {onRowSelect && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRowSelect(row)}
                            aria-label="Ver origem do registro"
                          >
                            Ver
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <nav
                className="mt-4 flex items-center justify-between gap-2"
                aria-label="Paginação da tabela"
              >
                <p className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------- barra de composição */

interface BreakdownProps {
  title: string;
  items: Array<{ key: string; label: string; total: number; count: number }>;
  format: (value: number) => string;
  limit?: number;
}

export const BreakdownList = ({ title, items, format, limit = 8 }: BreakdownProps) => {
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => Math.abs(i.total)));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          shown.map((item) => (
            <div key={item.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums font-medium">{format(item.total)}</span>
              </div>
              <div
                className="mt-1 h-2 rounded bg-muted"
                role="img"
                aria-label={`${item.label}: ${format(item.total)} em ${item.count} registro(s)`}
              >
                <div
                  className="h-2 rounded bg-primary"
                  style={{ width: `${Math.round((Math.abs(item.total) / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
