import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served at /app/ on the same domain as the Laravel API (see the Dockerfile and
// docker/nginx/default.conf), so it works on any domain without a rebuild.
// The native build (Capacitor) runs from the app bundle itself, so its assets load relatively.
const native = process.env.CAPACITOR_BUILD === '1'
const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Stamp a unique id into dist/sw.js so each build triggers a service-worker update check. */
function stampServiceWorkerBuildId() {
  return {
    name: 'stamp-service-worker-build-id',
    closeBundle() {
      const swPath = path.join(rootDir, 'dist', 'sw.js')
      if (!fs.existsSync(swPath)) return
      const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const source = fs.readFileSync(swPath, 'utf8')
      fs.writeFileSync(swPath, source.replaceAll('__BUILD_ID__', buildId))
    },
  }
}

export default defineConfig({
  base: native ? './' : '/app/',
  plugins: [react(), stampServiceWorkerBuildId()],
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
