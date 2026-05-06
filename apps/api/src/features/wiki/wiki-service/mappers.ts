import type { WikiHistoryDto, WikiPageDto } from "@kanban/shared";
import type { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { users } from "../../../db/schema/index.js";

type HistoryJoinRow = {
  wiki_page_history: typeof wikiPageHistory.$inferSelect;
  users: typeof users.$inferSelect | null;
};

export function parseWikiProperties<T>(properties: T): T | unknown {
  return typeof properties === "string" ? JSON.parse(properties) : properties;
}

export function toWikiPageDto(row: typeof wikiPages.$inferSelect): WikiPageDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    parentId: row.parentId,
    title: row.title,
    slug: row.slug,
    content: row.content,
    properties: parseWikiProperties(row.properties) ?? null,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toWikiHistoryDto(
  row: HistoryJoinRow | typeof wikiPageHistory.$inferSelect,
): WikiHistoryDto {
  const historyRow = "wiki_page_history" in row ? row.wiki_page_history : row;
  const userRow = "wiki_page_history" in row ? row.users : undefined;
  const dto: WikiHistoryDto = {
    id: historyRow.id,
    pageId: historyRow.pageId,
    title: historyRow.title,
    content: historyRow.content,
    properties: parseWikiProperties(historyRow.properties) ?? null,
    changedBy: historyRow.changedBy,
    createdAt: historyRow.createdAt,
  };

  if (userRow?.displayName) dto.changedByName = userRow.displayName;
  return dto;
}

export function generateWikiSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
