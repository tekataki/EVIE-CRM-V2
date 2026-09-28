import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { createAccounts } from './accounts.js'
// Shared renderer; external services are off unless explicitly configured.
const app = new Hono()
app.route('/api', createAccounts())
app.use('*', serveStatic({ root: './public' }))
export default app
