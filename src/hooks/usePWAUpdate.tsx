import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Detecta novas versões do Service Worker (waiting / updatefound),
 * expõe estado online/offline e aplica a atualização com um único reload.
 */
export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [updating, setUpdating] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let disposed = false;

    const trackWaiting = (sw: ServiceWorker | null) => {
      if (!sw || disposed) return;
      waitingRef.current = sw;
      setNeedRefresh(true);
    };

    const onControllerChange = () => {
      // Recarrega apenas uma vez, e somente quando nós pedimos a atualização
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration || disposed) return;

        trackWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              trackWaiting(registration.waiting ?? installing);
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    await registration.update();
    if (registration.waiting) {
      waitingRef.current = registration.waiting;
      setNeedRefresh(true);
      return true;
    }
    return false;
  }, []);

  const updateNow = useCallback(() => {
    const waiting = waitingRef.current;
    setUpdating(true);
    if (!waiting) {
      reloadedRef.current = true;
      window.location.reload();
      return;
    }
    // Se o controllerchange não chegar, força o reload como fallback
    window.setTimeout(() => {
      if (!reloadedRef.current) {
        reloadedRef.current = true;
        window.location.reload();
      }
    }, 4000);
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const dismiss = useCallback(() => setNeedRefresh(false), []);

  const clearOldCaches = useCallback(async () => {
    if (typeof caches === "undefined") return 0;
    const keys = await caches.keys();
    const stale = keys.filter((k) => /(^|-)precache-v\d+-|(^|-)runtime-/.test(k));
    await Promise.allSettled(stale.map((k) => caches.delete(k)));
    return stale.length;
  }, []);

  return { needRefresh, isOnline, updating, updateNow, dismiss, checkForUpdate, clearOldCaches };
};
