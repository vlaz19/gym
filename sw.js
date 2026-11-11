// =====================================================================
// sw.js — "Service worker": guarda la app en el móvil para que
// se abra al instante y funcione sin internet (p. ej. en el gimnasio).
// Tus DATOS no están aquí: están en IndexedDB (ver js/db.js).
// =====================================================================

// Si cambias algún archivo de la app, sube este número (v2, v3...)
const VERSION = 'gym-v6';

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

// Al instalarse: guarda una copia de todos los archivos
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// Al activarse: borra las copias de versiones antiguas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)))));
  self.clients.claim();
});

// Cada vez que la app pide un archivo: responde con la copia guardada al instante
// y, por detrás, descarga la versión nueva para la próxima vez.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardada = await cache.match(evento.request, { ignoreSearch: true });
      const deInternet = fetch(evento.request)
        .then((respuesta) => {
          if (respuesta.ok) cache.put(evento.request, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada);
      return guardada || deInternet;
    }));
});
