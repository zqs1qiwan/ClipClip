/* ClipClip static-asset service worker.
 *
 * Scope limited to the app shell and static assets. API responses
 * (/api/*) are never intercepted or cached because they contain
 * clipboard, paste, file and auth data.
 */
const CACHE_VERSION = "clipclip-static-v4";
const CACHE_NAME = `${CACHE_VERSION}`;
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/button-feedback.js",
  "/lib/clipboard.js",
  "/js/api.js",
  "/js/auth.js",
  "/js/brand.js",
  "/js/events.js",
  "/js/files.js",
  "/js/format.js",
  "/js/i18n.js",
  "/js/live.js",
  "/js/paste.js",
  "/js/pwa.js",
  "/js/qr.js",
  "/js/qr-modal.js",
  "/js/state.js",
  "/js/ui.js",
  "/js/views.js",
  "/manifest.json",
  "/brand/logo-mark.svg",
  "/brand/icon.svg"
];

const STATIC_EXTENSIONS = [".css", ".js", ".json", ".svg", ".png", ".jpg", ".webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("clipclip-static-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/js/")) {
    return true;
  }
  return STATIC_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
}

function cachePut(request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return;
  }
  caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  // Never touch API traffic (sensitive data; must hit the network).
  if (isApiRequest(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (url.pathname === "/" || url.pathname === "/index.html") {
            cachePut(request, response.clone());
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/index.html"))
            .then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            cachePut(request, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || network.then((response) => response || new Response("", { status: 504 }));
      })
    );
  }
});