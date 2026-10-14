import { defineConfig } from 'vite';

// relative base so the built site works from any folder/CDN path; esnext for the top-level await in main.js
export default defineConfig({
  base: './',
  build: { target: 'esnext', chunkSizeWarningLimit: 1500 },
  server: { host: '127.0.0.1', port: 5173 },
});
