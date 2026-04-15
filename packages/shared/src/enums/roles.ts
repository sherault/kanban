export const Role = {
  OWNER: "owner",
  MANAGER: "manager",
  MEMBER: "member",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
