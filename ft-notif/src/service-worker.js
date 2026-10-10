/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// SvelteKit registers this file automatically in production builds.
import { build, files, version } from '$service-worker';

const CACHE = `ft-cache-${version}`;

// App shell: built JS/CSS + everything in /static
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle our own origin — API calls (different origin) always go to the network
  if (url.origin !== self.location.origin) return;

  // Static/build assets: cache-first (they are versioned)
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((r) => r || fetch(request)));
    return;
  }

  // Pages: network-first, fall back to the last cached copy when offline
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await cache.match('/');
          if (shell) return shell;
        }
        return new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })()
  );
});
