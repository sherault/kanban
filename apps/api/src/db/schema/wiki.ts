import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organization.js";
import { projects } from "./project.js";
import { users } from "./identity.js";

export const wikiPages = sqliteTable("wiki_pages", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  parentId: text("parent_id")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .references((): any => wikiPages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const wikiPageHistory = sqliteTable("wiki_page_history", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => wikiPages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  changedBy: text("changed_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
