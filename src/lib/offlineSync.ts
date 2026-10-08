const DB_NAME = "gestao-line-tape-offline";
const STORE_NAME = "alteracoes";
const DB_VERSION = 1;
const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

type QueuedRequest = {
  id?: number;
  url: string;
  method: string;
  headers: [string, string][];
  body: string | null;
  createdAt: string;
};

export type OfflineSyncState = {
  pending: number;
  syncing: boolean;
};

const isSupabaseRestMutation = (url: string, method: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const apiHost = (() => {
      try { return new URL(String(import.meta.env.VITE_API_URL || "")).hostname; } catch { return ""; }
    })();
    return (apiHost ? parsed.hostname === apiHost : parsed.hostname.endsWith(".supabase.co")) &&
      parsed.pathname.startsWith("/rest/v1/") &&
      MUTATION_METHODS.has(method.toUpperCase());
  } catch {
    return false;
  }
};

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

const listQueued = () => withStore<QueuedRequest[]>("readonly", (store) => store.getAll());
const removeQueued = (id: number) => withStore("readwrite", (store) => store.delete(id));

const currentAccessToken = (): string | null => {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      const token = value?.access_token ?? value?.currentSession?.access_token;
      if (typeof token === "string") return token;
    } catch {
      // Ignora entradas antigas ou inválidas do navegador.
    }
  }
  return null;
};

const notifyState = async (syncing = false) => {
  const pending = await withStore<number>("readonly", (store) => store.count()).catch(() => 0);
  window.dispatchEvent(new CustomEvent<OfflineSyncState>("offline-sync-state", {
    detail: { pending, syncing },
  }));
};

const queueRequest = async (url: string, init: RequestInit) => {
  const headers = new Headers(init.headers);
  // O token pode expirar enquanto o computador está offline. No reenvio ele
  // será substituído pela sessão atual, sem gravar credenciais na fila.
  headers.delete("authorization");
  const queued: QueuedRequest = {
    url,
    method: (init.method ?? "POST").toUpperCase(),
    headers: Array.from(headers.entries()),
    body: typeof init.body === "string" ? init.body : null,
    createdAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.add(queued));
  await notifyState(false);
};

const offlineSuccess = (init: RequestInit): Response => {
  const method = (init.method ?? "POST").toUpperCase();
  const headers = new Headers(init.headers);
  let payload: unknown = null;
  if (typeof init.body === "string" && init.body) {
    try { payload = JSON.parse(init.body); } catch { payload = null; }
  }

  const wantsObject = headers.get("accept")?.includes("application/vnd.pgrst.object+json");
  const body = method === "DELETE"
    ? ""
    : JSON.stringify(wantsObject && Array.isArray(payload) ? payload[0] : payload ?? []);

  return new Response(body, {
    status: method === "POST" ? 201 : 200,
    headers: {
      "content-type": "application/json",
      "x-offline-queued": "true",
    },
  });
};

export const flushOfflineChanges = async (): Promise<void> => {
  if (!navigator.onLine) return;
  const queued = (await listQueued()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  if (!queued.length) {
    await notifyState(false);
    return;
  }

  await notifyState(true);
  for (const item of queued) {
    const headers = new Headers(item.headers);
    const token = currentAccessToken();
    if (token) headers.set("authorization", `Bearer ${token}`);

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: item.body,
      });
      if (!response.ok) break;
      if (item.id !== undefined) await removeQueued(item.id);
    } catch {
      break;
    }
  }
  await notifyState(false);
};

export const offlineFetch: typeof fetch = async (input, init?: RequestInit) => {
  const options: RequestInit = init ?? {};
  const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const method = (options.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (!navigator.onLine && isSupabaseRestMutation(url, method)) {
    const requestInit: RequestInit = input instanceof Request
      ? {
          method,
          headers: options.headers ?? input.headers,
          body: options.body ?? (await input.clone().text()),
        }
      : { ...options, method };
    await queueRequest(url, requestInit);
    return offlineSuccess(requestInit);
  }

  return fetch(input, options);
};

export const initializeOfflineSync = (): void => {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  window.addEventListener("online", () => void flushOfflineChanges());
  window.addEventListener("load", () => void notifyState(false));
  if (navigator.onLine) void flushOfflineChanges();
};
