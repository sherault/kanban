import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppDb, HonoEnv } from './types.js'
import { identityRoutes } from './features/identity/identity.routes.js'
import { organizationRoutes } from './features/organization/organization.routes.js'
import { invitationRoutes } from './features/invitation/invitation.routes.js'
import { apiKeyRoutes } from './features/api-key/api-key.routes.js'

export function createApp(db: AppDb): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    console.error(err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/auth', identityRoutes(db))
  app.route('/organizations', organizationRoutes(db))
  app.route('/invite', invitationRoutes(db))
  app.route('/profile', apiKeyRoutes(db))

  return app
}
