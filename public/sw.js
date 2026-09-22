// Caches only the public storefront shell and the public catalogue reads
// (shops, categories, products). Orders, customers, and anything under
// /owner or /admin are never intercepted, so nothing sensitive is cached.

const CACHE_NAME = "stl-catalogue-v1";
const CACHEABLE_API = [/\/rest\/v1\/shops/, /\/rest\/v1\/categories/, /\/rest\/v1\/products/];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isStorefrontPage = request.mode === "navigate" && url.pathname.startsWith("/s/") && !url.pathname.includes("/owner") && url.origin === self.location.origin;
  const isCatalogueApi = CACHEABLE_API.some((pattern) => pattern.test(request.url));
  if (!isStorefrontPage && !isCatalogueApi) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
