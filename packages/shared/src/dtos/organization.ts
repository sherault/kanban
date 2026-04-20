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

export interface InvitationTokenDto {
  id: string;
  organizationId: string;
  expiresAt: string;
  createdAt: string;
}
