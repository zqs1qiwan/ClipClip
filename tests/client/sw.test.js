import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SW_PATH = fileURLToPath(new URL("../../public/sw.js", import.meta.url));

// Load sw.js in a controlled VM with stubbed Service Worker globals, capturing
// the registered listeners. This lets us assert the caching policy without a browser.
async function loadServiceWorker() {
  const source = await fs.readFile(SW_PATH, "utf8");
  const listeners = new Map();
  const context = {
    URL,
    Promise,
    caches: {
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    fetch: async () => ({ ok: true, clone: () => ({}) }),
    Response: class Response {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
      }
    },
    console
  };
  context.self = {
    location: { origin: "http://localhost:5678" },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    skipWaiting: () => {},
    clients: { claim: () => {} }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "sw.js" });
  return { listeners, context };
}

function makeFetchEvent(pathname, { method = "GET", mode = "same-origin", origin } = {}) {
  const originValue = origin || "http://localhost:5678";
  let respondedWith = null;
  return {
    request: {
      method,
      mode,
      url: `${originValue}${pathname}`
    },
    respondWith(promise) {
      respondedWith = promise;
    },
    get responded() {
      return respondedWith;
    }
  };
}

test("sw.js registers install/activate/fetch listeners", async () => {
  const { listeners } = await loadServiceWorker();
  assert.ok(listeners.has("install"));
  assert.ok(listeners.has("activate"));
  assert.ok(listeners.has("fetch"));
});

test("service worker never intercepts /api/* data endpoints", async () => {
  const { listeners } = await loadServiceWorker();
  const fetchHandler = listeners.get("fetch");

  for (const path of [
    "/api/health",
    "/api/live",
    "/api/events",
    "/api/pastes/abc/reveal",
    "/api/files/recent",
    "/api/files/x/download",
    "/api" // exact match
  ]) {
    const event = makeFetchEvent(path);
    fetchHandler(event);
    assert.equal(event.responded, null, `${path} must not be intercepted or cached`);
  }
});

test("service worker ignores non-GET and cross-origin requests", async () => {
  const { listeners } = await loadServiceWorker();
  const fetchHandler = listeners.get("fetch");

  const post = makeFetchEvent("/api/pastes", { method: "POST" });
  fetchHandler(post);
  assert.equal(post.responded, null, "POST must never be intercepted");

  const cross = makeFetchEvent("/styles.css", { origin: "https://evil.example" });
  fetchHandler(cross);
  assert.equal(cross.responded, null, "cross-origin must never be intercepted");
});

test("service worker applies cache-first to static assets", async () => {
  const { listeners } = await loadServiceWorker();
  const fetchHandler = listeners.get("fetch");

  for (const path of ["/styles.css", "/app.js", "/js/qr.js", "/manifest.json", "/icon.svg"]) {
    const event = makeFetchEvent(path);
    fetchHandler(event);
    assert.notEqual(event.responded, null, `${path} should be handled by the SW`);
  }
});

test("service worker applies network-first to navigations", async () => {
  const { listeners } = await loadServiceWorker();
  const fetchHandler = listeners.get("fetch");

  const event = makeFetchEvent("/p/abc123", { mode: "navigate" });
  fetchHandler(event);
  assert.notEqual(event.responded, null, "navigations should be handled network-first");
});

test("sw.js source pins a versioned cache and never caches /api", async () => {
  const source = await fs.readFile(SW_PATH, "utf8");
  assert.match(source, /CACHE_VERSION\s*=\s*["']clipclip-static-/);
  assert.match(source, /isApiRequest/);
  assert.match(source, /api/);
  assert.match(source, /PRECACHE_URLS/);
  // Every entry in the PRECACHE_URLS array must be static — none may be an API
  // path. (The source legitimately contains "/api/" in the isApiRequest guard,
  // so asserting against the whole source would be a false positive.)
  const precacheBlock = source.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/)[1];
  const precacheEntries = [...precacheBlock.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(precacheEntries.length > 0);
  assert.equal(precacheEntries.some((entry) => entry.startsWith("/api")), false);
});
