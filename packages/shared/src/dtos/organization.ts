import type { Role } from "../enums/roles";
import type { UserDto } from "./identity";

export interface OrganizationDto {
  id: string;
  name: string;
  website: string | null;
  createdAt: string;
}

export interface MembershipDto {
  userId: string;
  organizationId: string;
  role: Role;
  user: Pick<UserDto, "id" | "displayName" | "email">;
}

/** A user who may be added to an organization, as returned by member search. */
export type MemberCandidateDto = Pick<UserDto, "id" | "displayName" | "email">;

export interface InvitationTokenDto {
  id: string;
  organizationId: string;
  expiresAt: string;
  createdAt: string;
}
