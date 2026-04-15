import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.js";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const memberships = sqliteTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "member"] })
      .notNull()
      .default("member"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
  }),
);

export const invitationTokens = sqliteTable("invitation_tokens", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  hashedToken: text("hashed_token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
