import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_URL || '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // LAN / OAuth dev (nip.io, sslip.io) e subdomínios locais
    allowedHosts: ['localhost', '.localhost', '.nip.io', '.sslip.io'],
    // Browser loads the app via nginx on :80; HMR WebSocket must use the same port.
    hmr: {
      clientPort: 80,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['html5-qrcode'],
  },
  chunkSizeWarningLimit: 3000,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
