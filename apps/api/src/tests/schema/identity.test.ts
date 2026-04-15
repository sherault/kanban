import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema/index.js";
import { createTestDb } from "../../db/test-utils.js";
import { users, apiKeys } from "../../db/schema/index.js";

let db: BetterSQLite3Database<typeof schema>;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  closeDb = testDb.close;
});

afterEach(() => closeDb());

describe("users table", () => {
  it("inserts and retrieves a user", () => {
    db.insert(users)
      .values({
        id: "user-1",
        email: "alice@example.com",
        passwordHash: "hash",
        displayName: "Alice",
      })
      .run();

    const result = db.select().from(users).all();
    expect(result).toHaveLength(1);
    expect(result[0]?.email).toBe("alice@example.com");
  });

  it("enforces email uniqueness", () => {
    db.insert(users)
      .values({
        id: "user-1",
        email: "alice@example.com",
        passwordHash: "hash",
        displayName: "Alice",
      })
      .run();

    expect(() =>
      db
        .insert(users)
        .values({
          id: "user-2",
          email: "alice@example.com",
          passwordHash: "hash2",
          displayName: "Alice 2",
        })
        .run(),
    ).toThrow();
  });
});

describe("api_keys table", () => {
  it("cascades delete when user is deleted", () => {
    db.insert(users)
      .values({
        id: "user-1",
        email: "alice@example.com",
        passwordHash: "hash",
        displayName: "Alice",
      })
      .run();

    db.insert(apiKeys)
      .values({
        id: "key-1",
        userId: "user-1",
        hashedKey: "hashed-key",
        label: "My Key",
      })
      .run();

    db.delete(users).run();
    const keys = db.select().from(apiKeys).all();
    expect(keys).toHaveLength(0);
  });
});
