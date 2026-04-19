import { config } from "dotenv";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
import path from "node:path";

config(); // Load environment variables first!

const rawUrl = process.env["DATABASE_URL"] ?? "./kanban.db";
// Handle "file:./path" format often used in .env
let databasePath = rawUrl.replace(/^file:/, "");

if (!path.isAbsolute(databasePath)) {
  // If we are running from apps/api, root is ../..
  // If we are running from root, root is .
  const cwd = process.cwd();
  const root = cwd.includes("apps/api") ? path.resolve(cwd, "../../") : cwd;
  databasePath = path.resolve(root, databasePath);
}
const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = DELETE"); // Force traditional journaling for max persistence safety
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
