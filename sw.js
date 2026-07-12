// Registered ONLY to satisfy PWA installability criteria (a controlling
// service worker) — not for offline support. This app's data is 100% live
// via Supabase; a service worker that caches HTML/JS/API responses risks
// reintroducing the exact stale-data bug class already fixed in this
// project's Phase 2 (a stale cached response served real data that no
// longer matched the database, breaking login for a real user).
//
// What this file does: nothing but exist and control the page.
// What this file explicitly does NOT do: call caches.open/match/put/add
// anywhere. No Cache Storage entry is ever created by this script. Every
// fetch falls through to the network exactly as if no service worker were
// registered at all. If a future change ever adds caching here, it must
// stay scoped to genuinely static, versioned assets (e.g. the icon PNGs)
// and never to page HTML, app JS, or any Supabase request.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally empty — not calling event.respondWith() means the
  // browser handles the request exactly as it would with no service
  // worker present at all.
});
