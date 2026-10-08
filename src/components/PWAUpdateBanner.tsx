import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, Loader2, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import type { OfflineSyncState } from "@/lib/offlineSync";

/**
 * Banner global: "Nova versão disponível" + estado offline.
 */
export const PWAUpdateBanner = () => {
  const { needRefresh, isOnline, updating, updateNow, dismiss } = usePWAUpdate();
  const [showOffline, setShowOffline] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncState, setSyncState] = useState<OfflineSyncState>({ pending: 0, syncing: false });

  useEffect(() => {
    const onSyncState = (event: Event) => {
      setSyncState((event as CustomEvent<OfflineSyncState>).detail);
    };
    window.addEventListener("offline-sync-state", onSyncState);
    return () => window.removeEventListener("offline-sync-state", onSyncState);
  }, []);

  useEffect(() => {
    setShowOffline(!isOnline);
    if (!isOnline) {
      setWasOffline(true);
      setShowSyncing(false);
      return;
    }

    if (wasOffline) {
      setShowSyncing(true);
      const timer = window.setTimeout(() => setShowSyncing(false), 8000);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!needRefresh && !showOffline && !showSyncing && syncState.pending === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(92vw,26rem)] -translate-x-1/2 space-y-2">
      {showOffline && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          <WifiOff className="h-4 w-4 text-destructive" />
          <span>
            Você está offline. As telas já abertas continuam disponíveis e suas
            alterações ficam salvas neste aparelho para sincronizar depois.
          </span>
        </div>
      )}

      {showSyncing && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          <CloudUpload className="h-4 w-4 animate-pulse text-primary" />
          <span>Internet restaurada. Sincronizando as alterações pendentes…</span>
        </div>
      )}

      {syncState.pending > 0 && !showOffline && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          <CloudUpload className={`h-4 w-4 text-primary ${syncState.syncing ? "animate-pulse" : ""}`} />
          <span>
            {syncState.syncing
              ? `Sincronizando ${syncState.pending} alteração(ões)…`
              : `${syncState.pending} alteração(ões) aguardando sincronização.`}
          </span>
        </div>
      )}

      {needRefresh && (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            <RefreshCw className="h-4 w-4 text-primary" />
            Nova versão disponível
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualize para carregar as últimas correções do sistema.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={updateNow} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Atualizar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={updating}>
              Depois
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
