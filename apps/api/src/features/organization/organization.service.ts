import { eq, and, ne } from 'drizzle-orm'
import type { AppDb } from '../../types.js'
import type { OrganizationDto, MembershipDto } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { forbidden, notFound, unprocessable } from '../../lib/errors.js'
import { organizations, memberships, users } from '../../db/schema/index.js'
import type { Role } from '@kanban/shared'

function toOrgDto(row: typeof organizations.$inferSelect): OrganizationDto {
  return { id: row.id, name: row.name, website: row.website, createdAt: row.createdAt }
}

export class OrganizationService {
  constructor(private readonly db: AppDb) {}

  createOrg(userId: string, input: { name: string; website?: string | null | undefined }): OrganizationDto {
    const id = generateId()
    const org = this.db
      .insert(organizations)
      .values({ id, name: input.name, website: input.website ?? null })
      .returning()
      .get()
    if (!org) throw new Error('Failed to create organization')
    this.db.insert(memberships).values({ userId, organizationId: id, role: 'owner' }).run()
    return toOrgDto(org)
  }

  listOrgs(userId: string): OrganizationDto[] {
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        website: organizations.website,
        createdAt: organizations.createdAt,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, userId))
      .all()
  }

  getOrg(orgId: string): OrganizationDto | undefined {
    const row = this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .get()
    return row ? toOrgDto(row) : undefined
  }

  updateOrg(orgId: string, input: { name?: string | undefined; website?: string | null | undefined }): OrganizationDto {
    const existing = this.db.select().from(organizations).where(eq(organizations.id, orgId)).get()
    if (!existing) throw notFound('Organization not found')
    const updated = this.db
      .update(organizations)
      .set({ ...(input.name !== undefined && { name: input.name }), ...(input.website !== undefined && { website: input.website }) })
      .where(eq(organizations.id, orgId))
      .returning()
      .get()
    if (!updated) throw new Error('Failed to update organization')
    return toOrgDto(updated)
  }

  deleteOrg(userId: string, orgId: string): void {
    const membership = this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, orgId)))
      .get()
    if (!membership || membership.role !== 'owner') throw forbidden()

    // Owner must have at least one other org
    const otherOrgs = this.db
      .select({ organizationId: memberships.organizationId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), ne(memberships.organizationId, orgId)))
      .all()
    if (otherOrgs.length === 0) {
      throw unprocessable('Cannot delete your only organization')
    }

    this.db.delete(organizations).where(eq(organizations.id, orgId)).run()
  }

  listMembers(orgId: string): MembershipDto[] {
    const rows = this.db
      .select({
        userId: memberships.userId,
        organizationId: memberships.organizationId,
        role: memberships.role,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, orgId))
      .all()

    return rows.map((r) => ({
      userId: r.userId,
      organizationId: r.organizationId,
      role: r.role as Role,
      user: { id: r.userId, email: r.userEmail, displayName: r.userDisplayName },
    }))
  }

  removeMember(orgId: string, targetUserId: string): void {
    const target = this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, targetUserId), eq(memberships.organizationId, orgId)))
      .get()
    if (!target) throw notFound('Member not found')
    if (target.role === 'owner') throw unprocessable('Cannot remove the owner')
    this.db
      .delete(memberships)
      .where(and(eq(memberships.userId, targetUserId), eq(memberships.organizationId, orgId)))
      .run()
  }

  transferOwnership(orgId: string, fromUserId: string, toUserId: string): void {
    const callerMem = this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, fromUserId), eq(memberships.organizationId, orgId)))
      .get()
    if (!callerMem || callerMem.role !== 'owner') throw forbidden()

    const targetMem = this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, toUserId), eq(memberships.organizationId, orgId)))
      .get()
    if (!targetMem) throw notFound('Target user is not a member of this organization')

    this.db
      .update(memberships)
      .set({ role: 'manager' })
      .where(and(eq(memberships.userId, fromUserId), eq(memberships.organizationId, orgId)))
      .run()
    this.db
      .update(memberships)
      .set({ role: 'owner' })
      .where(and(eq(memberships.userId, toUserId), eq(memberships.organizationId, orgId)))
      .run()
  }
}
