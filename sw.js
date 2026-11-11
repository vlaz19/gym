// =====================================================================
// sw.js — "Service worker": guarda una copia de la app en el móvil para
// que funcione sin internet (p. ej. con mala cobertura en el gimnasio).
// Tus DATOS no están aquí: están en IndexedDB (ver js/db.js).
// =====================================================================

// Si cambias algún archivo de la app, sube este número (v9, v10...)
// y también VERSION_APP en js/app.js, que es el que se ve en la pestaña Personal.
const VERSION = 'gym-v9';

// Si internet tarda más que esto, se usa la copia guardada
const ESPERA_RED_MS = 3000;

const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/db.js',
  'js/app.js',
  'js/temporizador.js',
  'js/rutina.js',
  'js/entrenar.js',
  'js/progreso.js',
  'js/personal.js',
  'iconos/icono-180.png',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
];

// Al instalarse: guarda una copia de todos los archivos.
// cache: 'reload' = descargarlos de internet sí o sí, sin usar copias antiguas del navegador
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) =>
    cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })))));
  self.skipWaiting();
});

// Al activarse: borra las copias de versiones antiguas y toma el control de la app
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()));
});

// Cada vez que la app pide un archivo: PRIMERO INTERNET (así siempre tienes la última versión).
// Si no hay conexión o tarda más de 3 s, se usa la copia guardada.
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;

  // cache: 'no-cache' = preguntar siempre a GitHub si el archivo ha cambiado
  // (si no ha cambiado, la respuesta es mínima y no gasta datos)
  const deInternet = caches.open(VERSION).then((cache) =>
    fetch(peticion.url, { cache: 'no-cache' }).then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
      return respuesta;
    }));
  evento.waitUntil(deInternet.catch(() => {})); // que termine de guardar aunque ya se haya respondido

  evento.respondWith((async () => {
    const guardada = await caches.match(peticion, { ignoreSearch: true });
    if (!guardada) return deInternet;
    const limite = new Promise((resolve) => setTimeout(() => resolve(guardada), ESPERA_RED_MS));
    const mejorRespuesta = deInternet
      .then((respuesta) => (respuesta.ok ? respuesta : guardada)) // si GitHub falla, la copia
      .catch(() => guardada);                                     // si no hay internet, la copia
    return Promise.race([mejorRespuesta, limite]);
  })());
});
