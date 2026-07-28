import type { AppDb, Broadcaster } from "../../types.js";
import { noopBroadcaster } from "../../types.js";
import type {
  OrganizationDto,
  MembershipDto,
  MemberCandidateDto,
} from "@kanban/shared";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from "./organization-service/organizations.js";
import {
  addOrganizationMember,
  listOrganizationMembers,
  removeOrganizationMember,
  transferOrganizationOwnership,
  updateOrganizationMemberRole,
} from "./organization-service/members.js";
import { searchMemberCandidates } from "./organization-service/member-search.js";

export class OrganizationService {
  constructor(
    readonly db: AppDb,
    readonly broadcast: Broadcaster = noopBroadcaster,
  ) {}

  createOrg(
    userId: string,
    input: { name: string; website?: string | null | undefined },
  ): OrganizationDto {
    return createOrganization(this, userId, input);
  }

  listOrgs(userId: string): OrganizationDto[] {
    return listOrganizations(this, userId);
  }

  getOrg(orgId: string): OrganizationDto | undefined {
    return getOrganization(this, orgId);
  }

  updateOrg(
    orgId: string,
    input: { name?: string | undefined; website?: string | null | undefined },
  ): OrganizationDto {
    return updateOrganization(this, orgId, input);
  }

  deleteOrg(userId: string, orgId: string): void {
    deleteOrganization(this, userId, orgId);
  }

  listMembers(orgId: string): MembershipDto[] {
    return listOrganizationMembers(this, orgId);
  }

  searchMemberCandidates(
    orgId: string,
    actorId: string,
    query: string,
  ): MemberCandidateDto[] {
    return searchMemberCandidates(this, orgId, actorId, query);
  }

  addMember(
    orgId: string,
    actorId: string,
    targetUserId: string,
  ): MembershipDto {
    return addOrganizationMember(this, orgId, actorId, targetUserId);
  }

  updateMemberRole(
    orgId: string,
    actorId: string,
    targetUserId: string,
    role: "member" | "manager",
  ): void {
    updateOrganizationMemberRole(this, orgId, actorId, targetUserId, role);
  }

  removeMember(orgId: string, targetUserId: string): void {
    removeOrganizationMember(this, orgId, targetUserId);
  }

  transferOwnership(orgId: string, fromUserId: string, toUserId: string): void {
    transferOrganizationOwnership(this, orgId, fromUserId, toUserId);
  }
}
