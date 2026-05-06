import type { OrganizationDto } from "@kanban/shared";
import { and, eq, ne } from "drizzle-orm";
import { organizations, memberships } from "../../../db/schema/index.js";
import { forbidden, notFound, unprocessable } from "../../../lib/errors.js";
import { generateId } from "../../../lib/id.js";
import type { OrganizationServiceContext } from "./context.js";
import { toOrgDto } from "./mappers.js";

type OrganizationInput = {
  name: string;
  website?: string | null | undefined;
};

type OrganizationUpdate = {
  name?: string | undefined;
  website?: string | null | undefined;
};

export function createOrganization(
  ctx: OrganizationServiceContext,
  userId: string,
  input: OrganizationInput,
): OrganizationDto {
  const id = generateId();
  const org = ctx.db
    .insert(organizations)
    .values({ id, name: input.name, website: input.website ?? null })
    .returning()
    .get();

  if (!org) throw new Error("Failed to create organization");

  ctx.db
    .insert(memberships)
    .values({ userId, organizationId: id, role: "owner" })
    .run();

  return toOrgDto(org);
}

export function listOrganizations(
  ctx: OrganizationServiceContext,
  userId: string,
): OrganizationDto[] {
  return ctx.db
    .select({
      id: organizations.id,
      name: organizations.name,
      website: organizations.website,
      createdAt: organizations.createdAt,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId))
    .all();
}

export function getOrganization(
  ctx: OrganizationServiceContext,
  orgId: string,
): OrganizationDto | undefined {
  const row = ctx.db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .get();
  return row ? toOrgDto(row) : undefined;
}

export function updateOrganization(
  ctx: OrganizationServiceContext,
  orgId: string,
  input: OrganizationUpdate,
): OrganizationDto {
  const existing = ctx.db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .get();

  if (!existing) throw notFound("Organization not found");

  const updated = ctx.db
    .update(organizations)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.website !== undefined && { website: input.website }),
    })
    .where(eq(organizations.id, orgId))
    .returning()
    .get();

  if (!updated) throw new Error("Failed to update organization");
  return toOrgDto(updated);
}

export function deleteOrganization(
  ctx: OrganizationServiceContext,
  userId: string,
  orgId: string,
): void {
  const membership = ctx.db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, orgId),
      ),
    )
    .get();

  if (!membership || membership.role !== "owner") throw forbidden();

  const otherOrgs = ctx.db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        ne(memberships.organizationId, orgId),
      ),
    )
    .all();

  if (otherOrgs.length === 0) {
    throw unprocessable("Cannot delete your only organization");
  }

  ctx.db.delete(organizations).where(eq(organizations.id, orgId)).run();
}
