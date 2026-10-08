import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

export interface SearchResult {
  id: string;
  label: string;
  sublabel?: string | null;
  tab: string;
  group: string;
}

interface Props {
  onNavigate: (tab: string) => void;
}

const MIN_CHARS = 2;

export const GlobalSearch = ({ onNavigate }: Props) => {
  const { userRole } = useCustomAuth();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const canSeeCommercial = userRole === "admin" || userRole === "financeiro";
  const canSeeOperations =
    userRole === "admin" || userRole === "funcionario" || userRole === "deposito";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  const search = useCallback(
    async (q: string) => {
      const current = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const like = `%${q.replace(/[%_]/g, "")}%`;
        const queries: PromiseLike<SearchResult[]>[] = [];

        if (canSeeOperations) {
          queries.push(
            supabase
              .from("equipment")
              .select("id, name, category")
              .ilike("name", like)
              .limit(5)
              .then(({ data }) =>
                (data ?? []).map((r) => ({
                  id: `eq-${r.id}`,
                  label: r.name,
                  sublabel: r.category,
                  tab: "equipment",
                  group: "Equipamentos",
                })),
              ),
          );
        }

        queries.push(
          supabase
            .from("events")
            .select("id, name, client_name")
            .ilike("name", like)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((r) => ({
                id: `ev-${r.id}`,
                label: r.name,
                sublabel: r.client_name,
                tab: "rentals",
                group: "Eventos",
              })),
            ),
        );

        if (canSeeCommercial) {
          queries.push(
            supabase
              .from("clients")
              .select("id, name, email")
              .ilike("name", like)
              .limit(5)
              .then(({ data }) =>
                (data ?? []).map((r) => ({
                  id: `cl-${r.id}`,
                  label: r.name,
                  sublabel: r.email,
                  tab: "clients",
                  group: "Clientes",
                })),
              ),
          );
          queries.push(
            supabase
              .from("external_quotes")
              .select("id, quote_number, client_name")
              .ilike("client_name", like)
              .limit(5)
              .then(({ data }) =>
                (data ?? []).map((r) => ({
                  id: `qt-${r.id}`,
                  label: r.client_name ?? r.quote_number ?? "Orçamento",
                  sublabel: r.quote_number,
                  tab: "contracts",
                  group: "Orçamentos",
                })),
              ),
          );
        }

        const settled = await Promise.all(queries);
        if (current !== requestId.current) return;
        setResults(settled.flat());
      } catch {
        if (current === requestId.current) setError("Não foi possível buscar agora.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    },
    [canSeeCommercial, canSeeOperations],
  );

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }
    void search(debounced);
  }, [debounced, search]);

  const grouped = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((acc, r) => {
      (acc[r.group] ??= []).push(r);
      return acc;
    }, {});
  }, [results]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Busca global"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar equipamentos, clientes, eventos, orçamentos…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          )}
          {error && <div className="p-4 text-sm text-destructive">{error}</div>}
          {!loading && !error && debounced.length >= MIN_CHARS && results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}
          {!loading && debounced.length < MIN_CHARS && (
            <div className="p-4 text-sm text-muted-foreground">
              Digite ao menos {MIN_CHARS} caracteres.
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.id}`}
                  onSelect={() => {
                    onNavigate(item.tab);
                    setOpen(false);
                    setTerm("");
                  }}
                >
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};
