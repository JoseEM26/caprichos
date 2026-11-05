/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Solo la cáscara de la app (lo que indica vite.config.ts). Sin rutas de caché para la API,
// /archivos ni /admin: precios, pedidos y caja se piden siempre al servidor.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Un despliegue nuevo toma el control enseguida; la página se recarga sola (registerType autoUpdate).
self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
