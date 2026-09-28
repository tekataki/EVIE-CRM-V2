import { Hono } from 'hono'
import { createAccounts } from './accounts.js'
// Shared renderer; external services are off unless explicitly configured.
const app = new Hono<{ Bindings: { ASSETS: { fetch(request: Request): Promise<Response> } } }>()
app.route('/api', createAccounts())
// Pages owns static-file resolution, redirects and response headers.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))
export default app
