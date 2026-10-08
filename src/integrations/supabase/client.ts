// Cliente de dados do app.
//
// O app continua usando a biblioteca supabase-js, mas agora conversa com o
// servidor próprio no Cloudflare (Worker), que responde nos mesmos caminhos
// do Supabase (/auth/v1, /rest/v1, /storage/v1, /functions/v1).
//
// Configure o endereço do Worker em VITE_API_URL (arquivo .env ou nas
// variáveis do Cloudflare Pages). Ex.: https://gestao-line-tape-api.<conta>.workers.dev
import { createClient } from '@supabase/supabase-js';
import { offlineFetch } from '@/lib/offlineSync';

export const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

if (!API_URL) {
  console.error('VITE_API_URL não configurada: o app não sabe o endereço do servidor.');
}

// Chave pública só identifica o app (não dá acesso a nada sozinha).
const PUBLIC_KEY = import.meta.env.VITE_API_PUBLIC_KEY || 'linetape-public';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient(API_URL || window.location.origin, PUBLIC_KEY, {
  global: {
    fetch: offlineFetch,
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ---------------------------------------------------------------------------
// Atualização automática das telas
//
// O Supabase Realtime (WebSocket) foi substituído por uma consulta leve a
// cada poucos segundos em /realtime/v1/changes. A interface usada pelas telas
// é a mesma: supabase.channel(...).on('postgres_changes', {table}, cb).subscribe()
// ---------------------------------------------------------------------------

type ChangeCallback = (payload: Record<string, unknown>) => void;
type Listener = { table: string | null; event: string; cb: ChangeCallback };

const POLL_MS = 4000;
const channels = new Set<PollingChannel>();
let lastVersion: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function poll() {
  timer = null;
  if (!channels.size) return;
  try {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (token) {
        const res = await fetch(`${API_URL}/realtime/v1/changes?since=${lastVersion ?? 0}`, {
          headers: { Authorization: `Bearer ${token}`, apikey: PUBLIC_KEY },
        });
        if (res.ok) {
          const body = (await res.json()) as { version: number; changes: { table: string }[] };
          if (lastVersion !== null && body.changes.length) {
            const tables = new Set(body.changes.map((c) => c.table));
            for (const ch of channels) ch.emit(tables);
          }
          lastVersion = body.version;
        }
      }
    }
  } catch {
    // sem rede: tenta de novo no próximo ciclo
  }
  schedule();
}

function schedule() {
  if (!timer && channels.size) timer = setTimeout(poll, POLL_MS);
}

class PollingChannel {
  name: string;
  listeners: Listener[] = [];
  constructor(name: string) {
    this.name = name;
  }
  on(type: string, filter: { event?: string; table?: string } | ChangeCallback, cb?: ChangeCallback) {
    if (type === 'postgres_changes' && typeof filter === 'object' && cb) {
      this.listeners.push({ table: filter.table ?? null, event: filter.event ?? '*', cb });
    }
    return this;
  }
  subscribe(cb?: (status: string) => void) {
    channels.add(this);
    if (lastVersion === null) void poll();
    else schedule();
    cb?.('SUBSCRIBED');
    return this;
  }
  emit(tables: Set<string>) {
    for (const l of this.listeners) {
      if (!l.table || tables.has(l.table)) {
        try {
          l.cb({ schema: 'public', table: l.table, eventType: '*', new: {}, old: {}, commit_timestamp: new Date().toISOString() });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
  unsubscribe() {
    channels.delete(this);
    return Promise.resolve('ok');
  }
  send() {
    return Promise.resolve('ok');
  }
  track() {
    return Promise.resolve('ok');
  }
  untrack() {
    return Promise.resolve('ok');
  }
  presenceState() {
    return {};
  }
}

const client = supabase as unknown as Record<string, unknown>;
client.channel = (name: string) => new PollingChannel(name);
client.removeChannel = (ch: PollingChannel) => {
  channels.delete(ch);
  return Promise.resolve('ok');
};
client.removeAllChannels = () => {
  channels.clear();
  return Promise.resolve([]);
};
client.getChannels = () => [...channels];
