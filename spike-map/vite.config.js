import { defineConfig } from 'vite'

// maplibre-gl v6 loads its worker as a sibling module via import.meta.url;
// Vite's dependency pre-bundling moves the entry and orphans the worker (404),
// so the style never finishes loading. Serve the package as-is instead.
export default defineConfig({
  server: { port: 5679, strictPort: true },
  build: { target: 'es2022' },
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
