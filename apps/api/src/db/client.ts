import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
import path from "node:path";

const rawUrl = process.env["DATABASE_URL"] ?? "./kanban.db";
// Handle "file:./path" format often used in .env
let databasePath = rawUrl.replace(/^file:/, "");

if (!path.isAbsolute(databasePath)) {
  const root =
    process.env.MONOREPO_ROOT || path.resolve(process.cwd(), "../../");
  databasePath = path.resolve(root, databasePath);
}
const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = DELETE"); // Force traditional journaling for max persistence safety
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
