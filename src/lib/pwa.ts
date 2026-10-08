/**
 * Registro controlado do Service Worker.
 *
 * O plugin NÃO injeta mais o registro automático (`injectRegister: null`):
 * este módulo é o único ponto que registra `/sw.js`. Em qualquer contexto de
 * desenvolvimento, preview do Lovable, iframe ou com `?sw=off` na URL, o
 * registro é recusado e qualquer service worker antigo é removido — foi
 * justamente um service worker antigo, registrado sem proteção, que passou a
 * servir HTML/JS obsoletos e deixar a página em branco.
 */

const SW_URL = "/sw.js";

const isPreviewHost = (hostname: string): boolean =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const isInsideIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/** Remove registros antigos de `/sw.js` (recuperação de cache corrompido). */
const unregisterAppServiceWorkers = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => {
          const scriptURL =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL ??
            "";
          return scriptURL.endsWith(SW_URL);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    /* nada a fazer: ambiente sem suporte ou bloqueado */
  }
};

export const registerServiceWorker = (): void => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
  const blocked =
    !import.meta.env.PROD ||
    killSwitch ||
    isInsideIframe() ||
    isPreviewHost(window.location.hostname);

  if (blocked) {
    void unregisterAppServiceWorkers();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => undefined);
  });
};
