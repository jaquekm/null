// Service worker (1.12; offline de leitura na 9.9).
//
// - "Shell" (ícones, manifest, /offline): guardado na instalação.
// - Arquivos estáticos do Next (/_next/static, com hash no nome — nunca mudam): cache primeiro.
// - Páginas do app: rede primeiro; cada página aberta com sucesso fica guardada no aparelho
//   (até MAX_PAGES), pra dar pra ler o que já foi aberto sem internet. Sem rede e sem cópia
//   guardada, cai em /offline.
// - Nunca guarda /api/*, páginas públicas de compartilhamento (/p/*), login/autenticação,
//   respostas redirecionadas ou que não sejam HTML 200. "Sair" apaga as páginas guardadas
//   (mensagem `clear-pages`, ver `src/lib/offline-cache.ts`).

const SHELL_CACHE = "hub-shell-v2";
const STATIC_CACHE = "jkode-static-v2";
const PAGE_CACHE = "jkode-pages-v2";
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGE_CACHE];
const MAX_PAGES = 60;
const MAX_STATIC = 400;

const SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const NEVER_CACHE_PREFIXES = ["/api/", "/p/", "/login", "/auth", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const excess = keys.length - max;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

function isCacheablePage(url) {
  return !NEVER_CACHE_PREFIXES.some((prefix) => url.pathname === prefix.replace(/\/$/, "") || url.pathname.startsWith(prefix));
}

async function handleNavigation(event, url) {
  try {
    const response = await fetch(event.request);
    const type = response.headers.get("content-type") || "";
    if (response.ok && !response.redirected && type.includes("text/html") && isCacheablePage(url)) {
      const copy = response.clone();
      event.waitUntil(
        caches
          .open(PAGE_CACHE)
          .then((cache) => cache.put(event.request, copy))
          .then(() => trimCache(PAGE_CACHE, MAX_PAGES)),
      );
    }
    return response;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const cached = (await cache.match(event.request)) || (await cache.match(event.request, { ignoreSearch: true }));
    return cached || (await caches.match("/offline")) || Response.error();
  }
}

async function handleStatic(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.put(event.request, copy))
        .then(() => trimCache(STATIC_CACHE, MAX_STATIC)),
    );
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, url));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(event));
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-pages") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

// Push pro dono (3.9) — payload: `{ title, body, url }` (ver `WebPushChannel`, `src/lib/messaging/web-push.ts`).
self.addEventListener("push", (event) => {
  let data = { title: "JKode", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload sem JSON válido: mantém o título/corpo padrão em vez de falhar a notificação
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.endsWith(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
