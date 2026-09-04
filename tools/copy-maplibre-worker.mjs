// Vendor MapLibre's worker next to the game (runs before `vite dev` / `vite build`).
// Why: maplibre-gl v6 resolves its worker with `new URL('./maplibre-gl-worker.mjs', import.meta.url)`
// at runtime. Vite's build never emits that file (the URL is computed), and in dev, serving the
// worker through Vite's module pipeline injects an HMR client that throws "document is not defined"
// inside the worker. Copying the worker + its shared chunk into public/ and pointing MapLibre at it
// with setWorkerUrl() sidesteps both. public/vendor/ is git-ignored; it tracks the installed version.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'maplibre-gl', 'dist')
const dst = join(root, 'public', 'vendor', 'maplibre')
mkdirSync(dst, { recursive: true })
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(join(src, f), join(dst, f))
console.log('[maplibre] worker vendored to public/vendor/maplibre/')
