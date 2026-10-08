import { useEffect, useMemo, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { normalizeText, onlyDigits } from '@/lib/quotes';

export interface ClientSuggestion {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
}

interface ClientAutocompleteProps {
  value: string;
  onSearchChange: (value: string) => void;
  onSelect: (client: ClientSuggestion) => void;
  label?: string;
  id?: string;
}

export function ClientAutocomplete({
  value,
  onSearchChange,
  onSelect,
  label = 'Buscar cliente cadastrado',
  id = 'client-autocomplete',
}: ClientAutocompleteProps) {
  const [clients, setClients] = useState<ClientSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [clientsRes, quotesRes] = await Promise.all([
          supabase.from('clients').select('id, name, phone, email, address').order('name'),
          supabase
            .from('external_quotes')
            .select('client_name, client_phone, client_email, client_document, client_address')
            .order('created_at', { ascending: false })
            .limit(300),
        ]);

        if (!active) return;

        const map = new Map<string, ClientSuggestion>();

        (clientsRes.data || []).forEach((row: any) => {
          const key = normalizeText(row.name);
          if (!key) return;
          map.set(key, {
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            email: row.email || '',
            address: row.address || '',
          });
        });

        (quotesRes.data || []).forEach((row: any) => {
          const key = normalizeText(row.client_name);
          if (!key) return;
          const existing = map.get(key);
          map.set(key, {
            id: existing?.id,
            name: existing?.name || row.client_name,
            phone: existing?.phone || row.client_phone || '',
            email: existing?.email || row.client_email || '',
            document: existing?.document || row.client_document || '',
            address: existing?.address || row.client_address || '',
          });
        });

        setClients(Array.from(map.values()));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const term = (value || '').trim();
    if (term.length < 2) return [];
    const digits = onlyDigits(term);
    const needle = normalizeText(term);

    return clients
      .filter((client) => {
        if (digits.length >= 3) {
          if (onlyDigits(client.phone).includes(digits)) return true;
          if (onlyDigits(client.document).includes(digits)) return true;
        }
        return (
          normalizeText(client.name).includes(needle) ||
          normalizeText(client.email).includes(needle)
        );
      })
      .slice(0, 8);
  }, [clients, value]);

  return (
    <div className="relative">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          value={value}
          autoComplete="off"
          placeholder="Nome, telefone, CPF/CNPJ ou e-mail"
          className="pl-9"
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && results.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
          role="listbox"
          aria-label="Clientes encontrados"
        >
          {results.map((client, index) => (
            <li key={`${client.id || client.name}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(client);
                  setOpen(false);
                }}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{client.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[client.phone, client.email, client.document].filter(Boolean).join(' • ') || 'Sem contato cadastrado'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && (value || '').trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Nenhum cliente encontrado. Os dados digitados abaixo serão usados.
        </p>
      )}
    </div>
  );
}

export default ClientAutocomplete;
