import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema/index.js";
import { createTestDb } from "../../db/test-utils.js";
import {
  users,
  organizations,
  memberships,
  projects,
} from "../../db/schema/index.js";

let db: BetterSQLite3Database<typeof schema>;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  closeDb = testDb.close;
  db.insert(users)
    .values({ id: "u1", email: "a@b.com", passwordHash: "h", displayName: "A" })
    .run();
  db.insert(organizations).values({ id: "o1", name: "Acme" }).run();
  db.insert(memberships)
    .values({ userId: "u1", organizationId: "o1", role: "owner" })
    .run();
});

afterEach(() => closeDb());

describe("projects table", () => {
  it("creates a project within an org", () => {
    db.insert(projects)
      .values({ id: "p1", organizationId: "o1", name: "Alpha" })
      .run();
    const result = db.select().from(projects).all();
    expect(result[0]?.name).toBe("Alpha");
  });

  it("cascades delete when org is deleted", () => {
    db.insert(projects)
      .values({ id: "p1", organizationId: "o1", name: "Alpha" })
      .run();
    db.delete(organizations).run();
    expect(db.select().from(projects).all()).toHaveLength(0);
  });
});
