/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const apiTarget = process.env.API_TARGET_URL || process.env.VITE_API_URL || 'http://localhost:3000';

const proxyConfig = {
  '/auth': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/admin': {
    target: apiTarget,
    changeOrigin: true,
    bypass: (req: any) => {
      if (req.headers.accept?.includes('text/html')) {
        return '/index.html';
      }
    },
  },
  '/carta': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/pedidos': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/archivos': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/salud': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/whatsapp': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/socket.io': {
    target: apiTarget,
    ws: true,
  },
};

export default defineConfig({
  plugins: [
    react(),
    // PWA instalable. Solo cachea el esqueleto de la app (precache); la API, /archivos y /admin van siempre a la red.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // El registro lo hace src/main.tsx (virtual:pwa-register) para que, al activarse un despliegue nuevo, la página se recargue
      injectRegister: false,
      manifest: {
        name: 'Caprichos',
        short_name: 'Caprichos',
        description: 'Carta, pedidos y panel del local Caprichos',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0B2C3E', // --cp-navy
        background_color: '#FBF4EC', // --cp-cream
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Solo la cáscara de la app: nada de datos de negocio (precios, pedidos, caja) entra en la caché
        globPatterns: ['**/*.{js,css,html}', 'manifest.webmanifest', 'icons/*.png', 'logo.webp', 'favicon.png'],
        // El bundle principal pesa ~2,9 MB (724 kB gzip): por encima del límite de 2 MiB por defecto
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 5273,
    host: true,
    proxy: proxyConfig,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
