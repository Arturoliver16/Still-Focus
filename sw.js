const SHELL_CACHE = "still-shell-v1";
const REMOTE_CACHE = "still-remote-v1";
const SHELL_PATHS = [
  "./still-focus.html",
  "./manifest.json",
  "./still-icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];
const REMOTE_ASSETS = [
  { url: "https://cdn.tailwindcss.com", mode: "no-cors" },
  { url: "https://unpkg.com/lucide@latest", mode: "no-cors" },
  { url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap", mode: "cors" }
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_PATHS.map(async path => {
      try {
        const url = new URL(path, self.registration.scope).href;
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await shell.put(url, response);
      } catch (_) {}
    }));
    const remote = await caches.open(REMOTE_CACHE);
    await Promise.all(REMOTE_ASSETS.map(async asset => {
      try {
        const request = new Request(asset.url, { mode: asset.mode, cache: "reload", credentials: "omit" });
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") await remote.put(request, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, REMOTE_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("still-") && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(REMOTE_CACHE);
      const saved = await cache.match(request);
      if (saved) return saved;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return saved || Response.error();
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return await cache.match(request) ||
          await cache.match(new URL("./still-focus.html", self.registration.scope).href) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const saved = await cache.match(request);
    if (saved) return saved;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
