import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// Internal QA harnesses and docs must never be published to production.
const PRIVATE = [/^review-.*\.(html|js)$/, /^tests(-.*)?\.(html|js)$/, /^project-files\.json$/, /\.(md|txt)$/]
function stripPrivate(): Plugin {
  return {
    name: 'evie-strip-private',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist')
      if (!fs.existsSync(dist)) return
      for (const name of fs.readdirSync(dist)) {
        if (PRIVATE.some((r) => r.test(name))) fs.rmSync(path.join(dist, name), { recursive: true, force: true })
      }
    }
  }
}

export default defineConfig({
  publicDir: 'public',
  plugins: [
    build({ entry: 'src/index.tsx', output: '_worker.js', outputDir: 'dist', emptyOutDir: true, staticPaths: [] }),
    devServer({ adapter, entry: 'src/index.tsx' }),
    stripPrivate()
  ]
})
