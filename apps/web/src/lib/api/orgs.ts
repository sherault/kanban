import type {
  InvitationTokenDto,
  MembershipDto,
  OrganizationDto,
} from "@kanban/shared";
import { apiFetch } from "./core";

export const orgsApi = {
  list(token: string) {
    return apiFetch<OrganizationDto[]>("/organizations", { token });
  },
  create(token: string, body: { name: string; website?: string | null }) {
    return apiFetch<OrganizationDto>("/organizations", {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
  },
  get(token: string, orgId: string) {
    return apiFetch<OrganizationDto>(`/organizations/${orgId}`, { token });
  },
  update(
    token: string,
    orgId: string,
    body: { name?: string; website?: string | null },
  ) {
    return apiFetch<OrganizationDto>(`/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    });
  },
  listMembers(token: string, orgId: string) {
    return apiFetch<MembershipDto[]>(`/organizations/${orgId}/members`, {
      token,
    });
  },
  createInvitation(token: string, orgId: string) {
    return apiFetch<InvitationTokenDto & { rawToken: string }>(
      `/organizations/${orgId}/invitations`,
      { method: "POST", token },
    );
  },
  updateMemberRole(
    token: string,
    orgId: string,
    userId: string,
    role: "member" | "manager",
  ) {
    return apiFetch<{ success: true }>(
      `/organizations/${orgId}/members/${userId}`,
      { method: "PATCH", body: JSON.stringify({ role }), token },
    );
  },
  removeMember(token: string, orgId: string, userId: string) {
    return apiFetch<{ success: true }>(
      `/organizations/${orgId}/members/${userId}`,
      { method: "DELETE", token },
    );
  },
  transferOwnership(token: string, orgId: string, toUserId: string) {
    return apiFetch<{ success: true }>(`/organizations/${orgId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ toUserId }),
      token,
    });
  },
  delete(token: string, orgId: string) {
    return apiFetch<{ success: true }>(`/organizations/${orgId}`, {
      method: "DELETE",
      token,
    });
  },
};
