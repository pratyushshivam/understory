import { defineConfig } from 'vite';

// Relative base so the static build works from any path (for example a GitHub Pages sub-folder).
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { port: 5193, strictPort: false },
  preview: { port: 5194 },
});
