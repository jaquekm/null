/**
 * "Sair" apaga as páginas guardadas pra leitura sem internet (9.9, `public/sw.js`) —
 * elas têm dados da dona e ficam no aparelho. Melhor esforço: sem service worker
 * ou sem Cache Storage, não faz nada.
 */
export const OFFLINE_PAGE_CACHE = "jkode-pages-v2";

export function clearOfflinePages(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
  } catch {
    // sem service worker ativo
  }
  if (typeof caches !== "undefined") void caches.delete(OFFLINE_PAGE_CACHE).catch(() => {});
}
