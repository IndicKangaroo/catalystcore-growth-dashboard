import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One .env at the repository root serves both apps. Only variables starting with VITE_ reach
  // the browser, so server settings in the same file stay private.
  envDir: '../..',
  server: {
    port: 5173,
    // In development the API runs on its own port; same-origin calls to /api are proxied to it.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
