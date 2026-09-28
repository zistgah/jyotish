/* Jyotish service worker: the whole instrument is cached, so it works with the network unplugged.
   SPDX-License-Identifier: GPL-3.0-or-later. (c) 1993-2026 Abhishek Choudhary. AyeAI. */
var CACHE = "jyotish-0.1.0";
var FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "app/app.css",
  "lib/data/jyotish-series.js", "lib/jyotish-ephem.js", "lib/jyotish-panchang.js", "lib/jyotish-calendar.js", "vendor/chakra-core.js", "vendor/chakra-plus.js",
  "lib/jyotish-kundali.js", "lib/jyotish-match.js", "lib/jyotish-muhurta.js", "lib/jyotish-events.js", "lib/jyotish-music.js", "lib/jyotish.js",
  "config/bundle.js", "app/app.js", "app/explain.js", "app/view-today.js", "app/views.js"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || fetch(e.request); }));
});
