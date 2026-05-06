import type { MembershipDto, OrganizationDto, Role } from "@kanban/shared";
import type { organizations } from "../../../db/schema/index.js";

type MembershipRow = {
  userId: string;
  organizationId: string;
  role: string;
  userEmail: string;
  userDisplayName: string;
};

export function toOrgDto(
  row: typeof organizations.$inferSelect,
): OrganizationDto {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    createdAt: row.createdAt,
  };
}

export function toMembershipDto(row: MembershipRow): MembershipDto {
  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role as Role,
    user: {
      id: row.userId,
      email: row.userEmail,
      displayName: row.userDisplayName,
    },
  };
}
