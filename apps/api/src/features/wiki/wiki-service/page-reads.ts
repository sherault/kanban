import type {
  WikiHistoryListDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";
import { desc, eq, sql } from "drizzle-orm";
import { memberships, users } from "../../../db/schema/index.js";
import { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { WikiServiceContext } from "./context.js";
import {
  parseWikiProperties,
  toWikiHistoryDto,
  toWikiPageDto,
} from "./mappers.js";
import { ensureOrganizationIndexPage } from "./project-index.js";

export async function getWikiPage(
  ctx: WikiServiceContext,
  pageId: string,
): Promise<WikiPageDto | undefined> {
  const [row] = await ctx.db
    .select()
    .from(wikiPages)
    .where(eq(wikiPages.id, pageId))
    .limit(1);

  return row ? toWikiPageDto(row) : undefined;
}

export async function listWikiPages(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
): Promise<WikiPageSummaryDto[]> {
  const rows = await selectWikiPageSummaries(ctx, orgId);
  if (rows.length > 0) return rows;

  await ensureRootWikiPage(
    ctx,
    orgId,
    await resolveCreatorId(ctx, orgId, userId),
  );
  return listWikiPages(ctx, orgId, userId);
}

export async function ensureRootWikiPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
): Promise<WikiPageDto> {
  return ensureOrganizationIndexPage(ctx, orgId, userId);
}

export async function searchWikiPages(
  ctx: WikiServiceContext,
  orgId: string,
  query: string,
): Promise<WikiPageSummaryDto[]> {
  const rows = await selectWikiPageSummaries(ctx, orgId);
  const normalizedQuery = query.toLowerCase();
  return rows.filter((r) => r.title.toLowerCase().includes(normalizedQuery));
}

export async function getWikiHistory(
  ctx: WikiServiceContext,
  pageId: string,
  options?: { limit?: number | undefined; offset?: number | undefined },
): Promise<WikiHistoryListDto> {
  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  const query = ctx.db
    .select()
    .from(wikiPageHistory)
    .leftJoin(users, eq(wikiPageHistory.changedBy, users.id))
    .where(eq(wikiPageHistory.pageId, pageId))
    // rowid breaks ties: createdAt only has second precision, so several
    // revisions of the same page can share a timestamp and paginate unstably.
    .orderBy(desc(wikiPageHistory.createdAt), sql`wiki_page_history.rowid desc`)
    .$dynamic();

  // Fetch one extra row to detect whether another page is available.
  const rows = limit
    ? await query.limit(limit + 1).offset(offset)
    : await query;

  const hasMore = limit !== undefined && rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
    toWikiHistoryDto(r),
  );

  return { items, hasMore };
}

async function selectWikiPageSummaries(
  ctx: WikiServiceContext,
  orgId: string,
): Promise<WikiPageSummaryDto[]> {
  const rows = await ctx.db
    .select({
      id: wikiPages.id,
      parentId: wikiPages.parentId,
      projectId: wikiPages.projectId,
      title: wikiPages.title,
      slug: wikiPages.slug,
      properties: wikiPages.properties,
    })
    .from(wikiPages)
    .where(eq(wikiPages.organizationId, orgId));

  return rows.map((row) => ({
    ...row,
    properties:
      (parseWikiProperties(row.properties) as Record<string, any>) ?? null,
  }));
}

async function resolveCreatorId(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
): Promise<string> {
  if (userId) return userId;

  const [firstMember] = await ctx.db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId))
    .limit(1);

  return firstMember?.userId || "unknown";
}
