import { eq, and } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import type { AppDb, HonoEnv } from '../types.js'
import { forbidden, notFound } from '../lib/errors.js'
import { projects, memberships } from '../db/schema/index.js'

/**
 * Looks up the project from :projectId param, checks org membership,
 * and sets orgId in context so downstream handlers can use it.
 */
export function makeProjectAuthz(db: AppDb) {
  return {
    requireProjectMember(): MiddlewareHandler<HonoEnv> {
      return async (c, next) => {
        const userId = c.get('userId')
        const projectId = c.req.param('projectId')

        const project = db
          .select({ organizationId: projects.organizationId })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get()

        if (!project) throw notFound('Project not found')

        const membership = db
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.organizationId, project.organizationId)
            )
          )
          .get()

        if (!membership) throw forbidden()

        c.set('orgId', project.organizationId)
        await next()
      }
    },
  }
}
