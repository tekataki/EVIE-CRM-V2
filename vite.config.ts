import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  // Copy the existing frontend byte-for-byte; only compile the backend.
  publicDir: 'public',
  plugins: [
    build({
      entry: 'src/index.tsx',
      output: '_worker.js',
      outputDir: 'dist',
      emptyOutDir: true,
      staticPaths: []
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
