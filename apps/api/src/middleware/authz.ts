import { eq, and } from 'drizzle-orm'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppDb, HonoEnv } from '../types.js'
import { forbidden } from '../lib/errors.js'
import { memberships } from '../db/schema/index.js'
import type { Role } from '@kanban/shared'

const ROLE_ORDER: Role[] = ['member', 'manager', 'owner']

function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(minRole)
}

export function makeAuthz(db: AppDb) {
  return {
    requireOrgRole(
      minRole: Role,
      getOrgId: (c: Context<HonoEnv>) => string | undefined
    ): MiddlewareHandler<HonoEnv> {
      return async (c, next) => {
        const userId = c.get('userId')
        const orgId = getOrgId(c)
        if (!orgId) throw forbidden()

        const membership = db
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.organizationId, orgId)
            )
          )
          .get()

        if (!membership) throw forbidden()
        if (!hasMinRole(membership.role as Role, minRole)) throw forbidden()

        await next()
      }
    },
  }
}
