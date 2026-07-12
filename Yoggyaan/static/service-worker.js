// YogGyaan Service Worker
// Strategy: cache-first for static assets (css/js/icons), network-first for
// everything else (HTML pages, /api/*). We deliberately do NOT cache pose
// detection JS aggressively with a long TTL trick - bump CACHE_VERSION
// whenever you ship a static asset change, or devices will keep old JS.

const CACHE_VERSION = "yoggyaan-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("yoggyaan-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept camera/media or API calls - always go to network fresh.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/static/css/") ||
    url.pathname.startsWith("/static/js/") ||
    url.pathname.startsWith("/static/icons/");

  if (isStaticAsset) {
    // Cache-first for static assets, fall back to network + update cache.
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Network-first for HTML pages - always show latest, fall back to cache offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// --- Push Notifications ---

self.addEventListener("push", (event) => {
  let payload = { title: "YogaSaathi", body: "Time for your practice!", url: "/dashboard" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/static/icons/icon-192.png",
      badge: "/static/icons/icon-192.png",
      data: { url: payload.url || "/dashboard" },
      tag: "yoggyaan-reminder",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
