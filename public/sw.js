// Minimal offline shell: the app itself (page + hashed assets) is cached so it opens
// without network; plans and images always come from the server (/api/* untouched).
const APP_CACHE = "hydraplan-app-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(["./", "manifest.webmanifest", "icon.svg"]);
      const html = await (await fetch("./", { cache: "no-store" })).text();
      await cache.addAll([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => m[1]));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== APP_CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(async (res) => {
          if (res.ok) await (await caches.open(APP_CACHE)).put("./", res.clone());
          return res;
        })
        .catch(async () => (await caches.match("./")) || Response.error())
    );
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
