/*
 * Service worker de MiTurno (PWA).
 * Estrategia network-first: la app siempre intenta traer lo último del
 * servidor (las actualizaciones llegan solas) y cae al caché si no hay red.
 */
const CACHE = "miturno-v1";
const OFFLINE_URLS = ["/", "/manifest.json", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Solo GET de nuestro propio origen; las llamadas a la API no se cachean.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copia));
        return respuesta;
      })
      .catch(() =>
        caches.match(request).then((cacheada) => cacheada || caches.match("/"))
      )
  );
});

// Notificaciones push (cuando el backend las habilite).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let datos = {};
  try {
    datos = event.data.json();
  } catch {
    datos = { title: "MiTurno", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(datos.title || "MiTurno", {
      body: datos.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
    })
  );
});
