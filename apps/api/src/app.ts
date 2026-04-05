import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppDb, Broadcaster, HonoEnv } from './types.js'
import { noopBroadcaster } from './types.js'
import { identityRoutes } from './features/identity/identity.routes.js'
import { organizationRoutes } from './features/organization/organization.routes.js'
import { invitationRoutes } from './features/invitation/invitation.routes.js'
import { apiKeyRoutes } from './features/api-key/api-key.routes.js'
import { projectRoutes } from './features/project/project.routes.js'
import { taskRoutes } from './features/task/task.routes.js'

export function createApp(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
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
  app.route('/organizations', projectRoutes(db, broadcast))
  app.route('/projects', taskRoutes(db, broadcast))
  app.route('/invite', invitationRoutes(db))
  app.route('/profile', apiKeyRoutes(db))

  return app
}
