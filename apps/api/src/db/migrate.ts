import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(): void {
  const migrationsFolder = join(__dirname, "../../drizzle/migrations");
  try {
    migrate(db, { migrationsFolder });
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  }
}
