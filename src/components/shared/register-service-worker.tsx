"use client";

import { useEffect } from "react";

/**
 * Registra `public/sw.js` (1.12) só em produção — em dev o service worker
 * atrapalha o Fast Refresh e pode servir respostas em cache.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
