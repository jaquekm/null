import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JKode",
    short_name: "JKode",
    description: "Notas, agenda, finanças, CRM e mais — sistema pessoal de organização.",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atalhos do ícone do app instalado (9.9: segurar o ícone no Android / clique direito no computador).
    shortcuts: [
      { name: "Capturar", short_name: "Capturar", description: "Anotar algo rápido", url: "/capturar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Falar", short_name: "Falar", description: "Capturar falando — vira texto", url: "/capturar?voz=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Hoje", short_name: "Hoje", description: "Agenda, lembretes e prazos do dia", url: "/hoje", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Agenda", short_name: "Agenda", description: "Compromissos", url: "/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    // Android: compartilhar de outro app abre /capturar com os parâmetros pré-preenchidos.
    // iOS não suporta share_target em PWA — o atalho de Shortcuts (1.12) cobre esse caso lá.
    share_target: {
      action: "/capturar",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
