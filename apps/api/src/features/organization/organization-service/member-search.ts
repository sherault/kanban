import type { MemberCandidateDto } from "@kanban/shared";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { memberships, users } from "../../../db/schema/index.js";
import type { OrganizationServiceContext } from "./context.js";

const MAX_CANDIDATES = 10;

/**
 * Users are only discoverable to an actor when they already share at least one
 * organization, so a manager cannot enumerate the whole user base by email.
 */
function actorOrganizationIds(
  ctx: OrganizationServiceContext,
  actorId: string,
): string[] {
  return ctx.db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(eq(memberships.userId, actorId))
    .all()
    .map((row) => row.organizationId);
}

function organizationMemberIds(
  ctx: OrganizationServiceContext,
  orgId: string,
): string[] {
  return ctx.db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId))
    .all()
    .map((row) => row.userId);
}

/** Escape the LIKE wildcards so a query of "%" does not match everything. */
function likePattern(query: string): string {
  const escaped = query
    .toLowerCase()
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

export function isCoVisibleUser(
  ctx: OrganizationServiceContext,
  actorId: string,
  userId: string,
): boolean {
  const actorOrgIds = actorOrganizationIds(ctx, actorId);
  if (actorOrgIds.length === 0) return false;

  return (
    ctx.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          inArray(memberships.organizationId, actorOrgIds),
        ),
      )
      .get() !== undefined
  );
}

export function searchMemberCandidates(
  ctx: OrganizationServiceContext,
  orgId: string,
  actorId: string,
  query: string,
): MemberCandidateDto[] {
  const actorOrgIds = actorOrganizationIds(ctx, actorId);
  if (actorOrgIds.length === 0) return [];

  const excludedIds = organizationMemberIds(ctx, orgId);

  const conditions = [
    inArray(memberships.organizationId, actorOrgIds),
    sql`lower(${users.email}) LIKE ${likePattern(query)} ESCAPE '\\'`,
  ];
  if (excludedIds.length > 0) {
    conditions.push(notInArray(users.id, excludedIds));
  }

  return ctx.db
    .selectDistinct({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(...conditions))
    .orderBy(users.email)
    .limit(MAX_CANDIDATES)
    .all();
}
