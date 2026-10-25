/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  '/socket.io': {
    target: apiTarget,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
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
