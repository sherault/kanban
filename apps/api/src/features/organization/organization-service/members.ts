import type { MembershipDto } from "@kanban/shared";
import { and, eq } from "drizzle-orm";
import { memberships, users } from "../../../db/schema/index.js";
import { forbidden, notFound, unprocessable } from "../../../lib/errors.js";
import type { OrganizationServiceContext } from "./context.js";
import { toMembershipDto } from "./mappers.js";

type MemberRole = "member" | "manager";

export function listOrganizationMembers(
  ctx: OrganizationServiceContext,
  orgId: string,
): MembershipDto[] {
  const rows = ctx.db
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
    .all();

  return rows.map(toMembershipDto);
}

export function updateOrganizationMemberRole(
  ctx: OrganizationServiceContext,
  orgId: string,
  actorId: string,
  targetUserId: string,
  role: MemberRole,
): void {
  const actor = getMemberRole(ctx, orgId, actorId);
  if (!actor || (actor !== "owner" && actor !== "manager")) throw forbidden();

  const target = getMemberRole(ctx, orgId, targetUserId);
  if (!target) throw notFound("Member not found");
  if (target === "owner") throw unprocessable("Cannot change the owner's role");

  ctx.db
    .update(memberships)
    .set({ role })
    .where(memberWhere(orgId, targetUserId))
    .run();

  ctx.broadcast(`org:${orgId}`, {
    type: "member.updated",
    payload: { userId: targetUserId, role },
  });
}

export function removeOrganizationMember(
  ctx: OrganizationServiceContext,
  orgId: string,
  targetUserId: string,
): void {
  const target = getMemberRole(ctx, orgId, targetUserId);
  if (!target) throw notFound("Member not found");
  if (target === "owner") throw unprocessable("Cannot remove the owner");

  ctx.db.delete(memberships).where(memberWhere(orgId, targetUserId)).run();
}

export function transferOrganizationOwnership(
  ctx: OrganizationServiceContext,
  orgId: string,
  fromUserId: string,
  toUserId: string,
): void {
  const callerRole = getMemberRole(ctx, orgId, fromUserId);
  if (callerRole !== "owner") throw forbidden();

  const targetRole = getMemberRole(ctx, orgId, toUserId);
  if (!targetRole) {
    throw notFound("Target user is not a member of this organization");
  }

  ctx.db
    .update(memberships)
    .set({ role: "manager" })
    .where(memberWhere(orgId, fromUserId))
    .run();

  ctx.db
    .update(memberships)
    .set({ role: "owner" })
    .where(memberWhere(orgId, toUserId))
    .run();
}

function getMemberRole(
  ctx: OrganizationServiceContext,
  orgId: string,
  userId: string,
): string | undefined {
  return ctx.db
    .select({ role: memberships.role })
    .from(memberships)
    .where(memberWhere(orgId, userId))
    .get()?.role;
}

function memberWhere(orgId: string, userId: string) {
  return and(
    eq(memberships.userId, userId),
    eq(memberships.organizationId, orgId),
  );
}
