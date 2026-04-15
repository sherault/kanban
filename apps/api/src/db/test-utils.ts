import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../lib/password.js";
import { generateId } from "../lib/id.js";
import * as schema from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "../../drizzle/migrations");

export function createTestDb(): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  close: () => void;
} {
  const sqlite: BetterSqlite3.Database = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { db, close: () => sqlite.close() };
}

/**
 * Insert a pre-verified user directly into the DB, bypassing email verification.
 * Use this in tests that need to log in without going through the full register flow.
 */
export async function createVerifiedUser(
  db: ReturnType<typeof drizzle<typeof schema>>,
  opts: { email: string; password: string; displayName?: string },
): Promise<{ id: string; email: string }> {
  const id = generateId();
  const passwordHash = await hashPassword(opts.password);
  db.insert(schema.users)
    .values({
      id,
      email: opts.email,
      passwordHash,
      displayName: opts.displayName ?? opts.email,
      emailVerified: true,
    })
    .run();
  return { id, email: opts.email };
}

/**
 * Helper for HTTP-level tests: creates a verified user and returns a valid
 * JWT accessToken + raw refresh token by calling the login endpoint.
 */
export async function loginTestUser(
  app: {
    request: (url: string, init?: RequestInit) => Response | Promise<Response>;
  },
  db: ReturnType<typeof drizzle<typeof schema>>,
  opts: { email: string; password: string; displayName?: string },
): Promise<{ accessToken: string; userId: string; cookieHeader: string }> {
  const { id } = await createVerifiedUser(db, opts);
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  });
  if (!res.ok) throw new Error(`loginTestUser: login failed (${res.status})`);
  const body = (await res.json()) as { accessToken: string };
  const cookieHeader = res.headers.get("set-cookie") ?? "";
  return { accessToken: body.accessToken, userId: id, cookieHeader };
}
