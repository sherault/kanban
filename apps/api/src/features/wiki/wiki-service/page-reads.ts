import type {
  WikiHistoryDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";
import { and, desc, eq } from "drizzle-orm";
import { memberships, users } from "../../../db/schema/index.js";
import { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { WikiServiceContext } from "./context.js";
import { toWikiHistoryDto, toWikiPageDto } from "./mappers.js";
import { createWikiPage } from "./page-writes.js";

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
  const [existing] = await ctx.db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.organizationId, orgId), eq(wikiPages.slug, "root")))
    .limit(1);

  if (existing) return toWikiPageDto(existing);

  const projectRows = await ctx.db.query.projects.findMany({
    where: (p, { eq }) => eq(p.organizationId, orgId),
  });
  const content = await buildRootContent(ctx, orgId, userId, projectRows);

  return createWikiPage(ctx, orgId, userId, {
    title: "Organization Index",
    content,
    slug: "root",
  });
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
): Promise<WikiHistoryDto[]> {
  const rows = await ctx.db
    .select()
    .from(wikiPageHistory)
    .leftJoin(users, eq(wikiPageHistory.changedBy, users.id))
    .where(eq(wikiPageHistory.pageId, pageId))
    .orderBy(desc(wikiPageHistory.createdAt));

  return rows.map((r) => toWikiHistoryDto(r));
}

async function selectWikiPageSummaries(
  ctx: WikiServiceContext,
  orgId: string,
): Promise<WikiPageSummaryDto[]> {
  return ctx.db
    .select({
      id: wikiPages.id,
      parentId: wikiPages.parentId,
      projectId: wikiPages.projectId,
      title: wikiPages.title,
      slug: wikiPages.slug,
    })
    .from(wikiPages)
    .where(eq(wikiPages.organizationId, orgId));
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

async function buildRootContent(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  projectRows: Array<{ id: string; name: string }>,
): Promise<string> {
  const lines = ["# Organization Knowledge Base", "", "## Projects", ""];

  for (const project of projectRows) {
    const pageId = await findOrCreateProjectPage(ctx, orgId, userId, project);
    lines.push(
      `- **${project.name}**: [Board](/orgs/${orgId}/projects/${project.id}) | [Wiki Page](/orgs/${orgId}/projects/${project.id}?page=${pageId})`,
    );
  }

  lines.push(
    "",
    "---",
    "",
    "*This index is managed by the organization. You can edit additional notes below.*",
  );
  return lines.join("\n");
}

async function findOrCreateProjectPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  project: { id: string; name: string },
): Promise<string> {
  const [projectPage] = await ctx.db
    .select()
    .from(wikiPages)
    .where(
      and(
        eq(wikiPages.projectId, project.id),
        eq(wikiPages.organizationId, orgId),
      ),
    )
    .limit(1);

  if (projectPage) return projectPage.id;

  const newPage = await createWikiPage(ctx, orgId, userId, {
    title: `${project.name} Knowledge Base`,
    content: `# ${project.name}\n\nDocumentation for project ${project.name} starts here.`,
    projectId: project.id,
    parentId: null,
  });
  return newPage.id;
}
