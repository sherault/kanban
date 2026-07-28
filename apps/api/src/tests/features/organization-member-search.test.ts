import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createTestDb,
  createVerifiedUser,
  loginTestUser,
} from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { memberships, organizations } from "../../db/schema/index.js";
import type { MembershipDto } from "@kanban/shared";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

type Db = ReturnType<typeof createTestDb>["db"];
type Role = "owner" | "manager" | "member";

function createOrg(db: Db, name: string): string {
  const id = randomUUID();
  db.insert(organizations).values({ id, name }).run();
  return id;
}

function addMembership(
  db: Db,
  orgId: string,
  userId: string,
  role: Role = "member",
): void {
  db.insert(memberships).values({ organizationId: orgId, userId, role }).run();
}

async function addUser(
  db: Db,
  email: string,
  displayName: string,
): Promise<string> {
  const { id } = await createVerifiedUser(db, {
    email,
    password: "password123",
    displayName,
  });
  return id;
}

/**
 * World shared by most tests:
 *
 * - orgA (target) — alice is owner, carol is a member, erin is a plain member
 * - orgB (shared)  — alice and bob both belong, making bob co-visible to alice
 * - orgC (foreign) — dave only; no overlap with alice
 */
async function setup() {
  const testDb = createTestDb();
  const { db } = testDb;
  const app = createApp(db);

  const alice = await loginTestUser(app, db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });

  const orgA = createOrg(db, "Org A");
  const orgB = createOrg(db, "Org B");
  const orgC = createOrg(db, "Org C");

  addMembership(db, orgA, alice.userId, "owner");
  addMembership(db, orgB, alice.userId, "manager");

  const bob = await addUser(db, "bob@search.test", "Bob");
  addMembership(db, orgB, bob);

  const carol = await addUser(db, "carol@search.test", "Carol");
  addMembership(db, orgA, carol);
  addMembership(db, orgB, carol);

  const dave = await addUser(db, "dave@search.test", "Dave");
  addMembership(db, orgC, dave);

  const erin = await loginTestUser(app, db, {
    email: "erin@example.com",
    password: "password123",
    displayName: "Erin",
  });
  addMembership(db, orgA, erin.userId, "member");
  addMembership(db, orgB, erin.userId, "member");

  return {
    app,
    db,
    close: testDb.close,
    orgA,
    orgB,
    alice,
    erin,
    bob,
    carol,
    dave,
  };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function candidatesUrl(orgId: string, q: string) {
  return `/organizations/${orgId}/member-candidates?q=${encodeURIComponent(q)}`;
}

type Candidate = { id: string; email: string; displayName: string };

describe("GET /organizations/:orgId/member-candidates", () => {
  it("returns co-visible users matching a partial email", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "bob@sea"), {
      headers: authHeaders(w.alice.accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Candidate[];
    expect(body.map((c) => c.id)).toEqual([w.bob]);
    expect(body[0]).toMatchObject({
      email: "bob@search.test",
      displayName: "Bob",
    });
    w.close();
  });

  it("excludes users who are already members of the org", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "search.test"), {
      headers: authHeaders(w.alice.accessToken),
    });
    const body = (await res.json()) as Candidate[];
    expect(body.map((c) => c.id)).not.toContain(w.carol);
    w.close();
  });

  it("excludes users who share no organization with the actor", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "search.test"), {
      headers: authHeaders(w.alice.accessToken),
    });
    const body = (await res.json()) as Candidate[];
    expect(body.map((c) => c.id)).not.toContain(w.dave);
    w.close();
  });

  it("returns each co-visible user once even across several shared orgs", async () => {
    const w = await setup();
    const orgD = createOrg(w.db, "Org D");
    addMembership(w.db, orgD, w.alice.userId, "manager");
    addMembership(w.db, orgD, w.bob);

    const res = await w.app.request(candidatesUrl(w.orgA, "bob@"), {
      headers: authHeaders(w.alice.accessToken),
    });
    const body = (await res.json()) as Candidate[];
    expect(body.map((c) => c.id)).toEqual([w.bob]);
    w.close();
  });

  it("rejects a query shorter than 3 characters", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "bo"), {
      headers: authHeaders(w.alice.accessToken),
    });
    expect(res.status).toBe(400);
    w.close();
  });

  it("rejects a query longer than 320 characters", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "a".repeat(321)), {
      headers: authHeaders(w.alice.accessToken),
    });
    expect(res.status).toBe(400);
    w.close();
  });

  it("caps results at 10", async () => {
    const w = await setup();
    for (let i = 0; i < 12; i++) {
      const id = await addUser(w.db, `bulk${i}@bulk.test`, `Bulk ${i}`);
      addMembership(w.db, w.orgB, id);
    }
    const res = await w.app.request(candidatesUrl(w.orgA, "bulk.test"), {
      headers: authHeaders(w.alice.accessToken),
    });
    const body = (await res.json()) as Candidate[];
    expect(body).toHaveLength(10);
    w.close();
  });

  it("returns 403 for a plain member of the org", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "bob@"), {
      headers: authHeaders(w.erin.accessToken),
    });
    expect(res.status).toBe(403);
    w.close();
  });

  it("returns 401 without auth", async () => {
    const w = await setup();
    const res = await w.app.request(candidatesUrl(w.orgA, "bob@"));
    expect(res.status).toBe(401);
    w.close();
  });
});

function postMember(
  app: Awaited<ReturnType<typeof setup>>["app"],
  token: string,
  orgId: string,
  userId: string,
) {
  return app.request(`/organizations/${orgId}/members`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

describe("POST /organizations/:orgId/members", () => {
  it("adds a co-visible user as a member and returns 201", async () => {
    const w = await setup();
    const res = await postMember(w.app, w.alice.accessToken, w.orgA, w.bob);
    expect(res.status).toBe(201);
    const body = (await res.json()) as MembershipDto;
    expect(body).toMatchObject({
      userId: w.bob,
      organizationId: w.orgA,
      role: "member",
      user: { id: w.bob, email: "bob@search.test", displayName: "Bob" },
    });

    const list = await w.app.request(`/organizations/${w.orgA}/members`, {
      headers: authHeaders(w.alice.accessToken),
    });
    const members = (await list.json()) as MembershipDto[];
    expect(members.map((m) => m.userId)).toContain(w.bob);
    w.close();
  });

  it("no longer lists the user as a candidate once added", async () => {
    const w = await setup();
    await postMember(w.app, w.alice.accessToken, w.orgA, w.bob);
    const res = await w.app.request(candidatesUrl(w.orgA, "bob@"), {
      headers: authHeaders(w.alice.accessToken),
    });
    expect(await res.json()).toEqual([]);
    w.close();
  });

  it("returns 422 when the user is already a member", async () => {
    const w = await setup();
    const res = await postMember(w.app, w.alice.accessToken, w.orgA, w.carol);
    expect(res.status).toBe(422);
    w.close();
  });

  it("returns 403 when the user shares no organization with the actor", async () => {
    const w = await setup();
    const res = await postMember(w.app, w.alice.accessToken, w.orgA, w.dave);
    expect(res.status).toBe(403);
    w.close();
  });

  it("returns 404 for an unknown user id", async () => {
    const w = await setup();
    const res = await postMember(
      w.app,
      w.alice.accessToken,
      w.orgA,
      randomUUID(),
    );
    expect(res.status).toBe(404);
    w.close();
  });

  it("returns 400 for a malformed user id", async () => {
    const w = await setup();
    const res = await postMember(w.app, w.alice.accessToken, w.orgA, "nope");
    expect(res.status).toBe(400);
    w.close();
  });

  it("returns 403 for a plain member of the org", async () => {
    const w = await setup();
    const res = await postMember(w.app, w.erin.accessToken, w.orgA, w.bob);
    expect(res.status).toBe(403);
    w.close();
  });

  it("returns 401 without auth", async () => {
    const w = await setup();
    const res = await w.app.request(`/organizations/${w.orgA}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: w.bob }),
    });
    expect(res.status).toBe(401);
    w.close();
  });
});
