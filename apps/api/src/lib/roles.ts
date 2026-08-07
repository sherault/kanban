import type { Role } from "@kanban/shared";

const ROLE_ORDER: Role[] = ["member", "manager", "owner"];

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(minRole);
}
