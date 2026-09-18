import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hub",
    short_name: "Hub",
    description: "Notas, agenda, finanças, CRM e mais — sistema pessoal de organização.",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
