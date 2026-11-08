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

// «Buscar actualización» del panel de instalación pide aplicar ya la versión en espera
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
