import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { memberships } from "../../db/schema/index.js";
import { OrganizationService } from "../../features/organization/organization.service.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const events: Array<{ room: string; event: unknown }> = [];
  const orgSvc = new OrganizationService(testDb.db, (room, event) => {
    events.push({ room, event });
  });

  const owner = await createVerifiedUser(testDb.db, {
    email: "owner@example.com",
    password: "password123",
    displayName: "Owner",
  });
  const manager = await createVerifiedUser(testDb.db, {
    email: "manager@example.com",
    password: "password123",
    displayName: "Manager",
  });
  const member = await createVerifiedUser(testDb.db, {
    email: "member@example.com",
    password: "password123",
    displayName: "Member",
  });
  const org = orgSvc.createOrg(owner.id, { name: "Acme" });

  testDb.db
    .insert(memberships)
    .values([
      { userId: manager.id, organizationId: org.id, role: "manager" },
      { userId: member.id, organizationId: org.id, role: "member" },
    ])
    .run();

  return { testDb, orgSvc, events, org, owner, manager, member };
}

describe("OrganizationService member operations", () => {
  it("allows managers to update members and broadcasts the change", async () => {
    const { testDb, orgSvc, events, org, manager, member } = await setup();

    orgSvc.updateMemberRole(org.id, manager.id, member.id, "manager");

    const members = orgSvc.listMembers(org.id);
    expect(members.find((row) => row.userId === member.id)?.role).toBe(
      "manager",
    );
    expect(events).toEqual([
      {
        room: `org:${org.id}`,
        event: {
          type: "member.updated",
          payload: { userId: member.id, role: "manager" },
        },
      },
    ]);
    testDb.close();
  });

  it("transfers ownership and demotes the previous owner", async () => {
    const { testDb, orgSvc, org, owner, member } = await setup();

    orgSvc.transferOwnership(org.id, owner.id, member.id);

    const members = orgSvc.listMembers(org.id);
    expect(members.find((row) => row.userId === owner.id)?.role).toBe(
      "manager",
    );
    expect(members.find((row) => row.userId === member.id)?.role).toBe("owner");
    testDb.close();
  });

  it("keeps owners protected from role changes and removal", async () => {
    const { testDb, orgSvc, org, owner, manager } = await setup();

    expect(() =>
      orgSvc.updateMemberRole(org.id, manager.id, owner.id, "member"),
    ).toThrow("Cannot change the owner's role");
    expect(() => orgSvc.removeMember(org.id, owner.id)).toThrow(
      "Cannot remove the owner",
    );
    testDb.close();
  });
});
