import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

function createServiceWorkerHarness(fetchImpl: (request: { url: string }) => Promise<Response>) {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const cachedResponses = new Map<string, Response>();
  const cachedUrls: string[] = [];
  const origin = "https://nota.example";
  const cache = {
    addAll: async (paths: string[]) => {
      for (const path of paths) {
        const url = new URL(path, origin).href;
        cachedUrls.push(url);
        cachedResponses.set(url, new Response(`cached:${path}`));
      }
    },
    match: async (request: string | { url: string }) => {
      const url = typeof request === "string" ? new URL(request, origin).href : request.url;
      return cachedResponses.get(url)?.clone() ?? null;
    },
    put: async (request: string | { url: string }, response: Response) => {
      const url = typeof request === "string" ? new URL(request, origin).href : request.url;
      cachedUrls.push(url);
      cachedResponses.set(url, response.clone());
    },
  };
  const cacheStorage = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: cache.match,
  };
  const self = {
    location: { origin },
    addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => listeners.set(type, listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };

  runInNewContext(serviceWorkerSource, {
    self,
    caches: cacheStorage,
    fetch: fetchImpl,
    URL,
    Response,
    Promise,
  });

  return { listeners, cachedResponses, cachedUrls, origin };
}

test("service worker caches only static app assets and the offline fallback", async () => {
  const harness = createServiceWorkerHarness(async () => new Response("network"));
  let installWork: Promise<void> | undefined;
  harness.listeners.get("install")?.({ waitUntil: (promise: Promise<void>) => { installWork = promise; } });
  await installWork;

  assert.ok(harness.cachedUrls.includes(`${harness.origin}/offline.html`));
  assert.ok(harness.cachedUrls.includes(`${harness.origin}/manifest.webmanifest`));
  assert.ok(harness.cachedUrls.includes(`${harness.origin}/icon-192x192.png`));
  assert.ok(harness.cachedUrls.includes(`${harness.origin}/icon-512x512.png`));
  assert.ok(harness.cachedUrls.every(url => !/\/api\/|\/share\/|\/oauth\/|\/mcp(?:\/|$)/.test(new URL(url).pathname)));
});

test("service worker never caches authenticated API or shared-note responses", async () => {
  const networkUrls: string[] = [];
  const interceptedPaths: string[] = [];
  const harness = createServiceWorkerHarness(async request => {
    networkUrls.push(request.url);
    return new Response("private response");
  });

  for (const path of ["/api/notes", "/api/auth/me", "/share/secret", "/api/oauth/token", "/api/mcp"]) {
    let responseWork: Promise<Response> | undefined;
    harness.listeners.get("fetch")?.({
      request: { url: `${harness.origin}${path}`, method: "GET", mode: path.startsWith("/share/") ? "navigate" : "cors" },
      respondWith: (promise: Promise<Response>) => { responseWork = promise; },
    });
    if (responseWork) {
      interceptedPaths.push(path);
      await responseWork;
    }
  }

  assert.deepEqual(interceptedPaths, ["/share/secret"]);
  assert.deepEqual(networkUrls, [`${harness.origin}/share/secret`]);
  assert.deepEqual(harness.cachedUrls, []);
});

test("offline navigations receive the cached offline page without caching page HTML", async () => {
  const harness = createServiceWorkerHarness(async () => { throw new Error("offline"); });
  let installWork: Promise<void> | undefined;
  harness.listeners.get("install")?.({ waitUntil: (promise: Promise<void>) => { installWork = promise; } });
  await installWork;

  let navigationWork: Promise<Response> | undefined;
  harness.listeners.get("fetch")?.({
    request: { url: `${harness.origin}/`, method: "GET", mode: "navigate" },
    respondWith: (promise: Promise<Response>) => { navigationWork = promise; },
  });

  assert.ok(navigationWork);
  assert.equal(await (await navigationWork).text(), "cached:/offline.html");
  assert.ok(harness.cachedUrls.every(url => new URL(url).pathname !== "/"));
});

test("hashed Next.js assets use the runtime cache", async () => {
  const harness = createServiceWorkerHarness(async () => new Response("compiled asset"));
  let assetWork: Promise<Response> | undefined;
  const assetUrl = `${harness.origin}/_next/static/chunks/app-123.js`;
  harness.listeners.get("fetch")?.({
    request: { url: assetUrl, method: "GET", mode: "same-origin" },
    respondWith: (promise: Promise<Response>) => { assetWork = promise; },
  });

  assert.ok(assetWork);
  assert.equal(await (await assetWork).text(), "compiled asset");
  assert.ok(harness.cachedUrls.includes(assetUrl));
});
