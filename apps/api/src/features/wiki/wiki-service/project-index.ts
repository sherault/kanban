import type { WikiPageDto } from "@kanban/shared";
import { and, eq, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { memberships, projects } from "../../../db/schema/index.js";
import { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { WikiServiceContext } from "./context.js";
import { generateWikiSlug, toWikiPageDto } from "./mappers.js";

const AUTO_INDEX_START = "<!-- kanban:auto-project-index:start -->";
const AUTO_INDEX_END = "<!-- kanban:auto-project-index:end -->";
const DELETED_PROJECT_PREFIX = "[DELETED PROJECT]";

type ProjectIndexRow = Pick<typeof projects.$inferSelect, "id" | "name">;
type WikiPageRow = typeof wikiPages.$inferSelect;

type DeletedProjectEntry = {
  name: string;
  deletedAt: string;
  pageId: string | null;
};

type SyncIndexOptions = {
  excludeProjectId?: string;
  deletedProject?: DeletedProjectEntry;
};

export function ensureOrganizationIndexPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
): WikiPageDto {
  return syncOrganizationIndex(ctx, orgId, userId);
}

export function syncOrganizationIndexForProjectCreated(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
): WikiPageDto {
  findOrCreateProjectKnowledgeBase(
    ctx,
    orgId,
    resolveIndexUserId(ctx, orgId, userId),
    project,
  );
  return syncOrganizationIndex(ctx, orgId, userId);
}

export function syncOrganizationIndexForProjectDeleted(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
  deletedAt = new Date(),
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  const topPage = findProjectKnowledgeBase(ctx, orgId, project.id);
  if (topPage) markProjectKnowledgeBaseDeleted(ctx, topPage, actorId);

  return syncOrganizationIndex(ctx, orgId, actorId, {
    excludeProjectId: project.id,
    deletedProject: {
      name: project.name,
      deletedAt: formatDeletedAt(deletedAt),
      pageId: topPage?.id ?? null,
    },
  });
}

function syncOrganizationIndex(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
  options: SyncIndexOptions = {},
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  const rootPage = findOrganizationIndexPage(ctx, orgId);
  const liveProjects = listActiveProjects(ctx, orgId, options.excludeProjectId);
  const deletedProjects = mergeDeletedProjectEntries(
    extractDeletedProjectEntries(rootPage?.content ?? ""),
    options.deletedProject,
  );
  const content = upsertAutomatedIndexBlock(
    rootPage?.content ?? defaultOrganizationIndexContent(),
    buildAutomatedIndexBlock(
      ctx,
      orgId,
      actorId,
      liveProjects,
      deletedProjects,
    ),
  );

  if (!rootPage) {
    return createTrackedWikiPage(ctx, orgId, actorId, {
      title: "Organization Index",
      slug: "root",
      content,
      projectId: null,
      parentId: null,
    });
  }

  if (rootPage.content === content) return toWikiPageDto(rootPage);

  return updateTrackedWikiPage(ctx, rootPage, actorId, { content });
}

function findOrganizationIndexPage(
  ctx: WikiServiceContext,
  orgId: string,
): WikiPageRow | undefined {
  return ctx.db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.organizationId, orgId), eq(wikiPages.slug, "root")))
    .limit(1)
    .get();
}

function listActiveProjects(
  ctx: WikiServiceContext,
  orgId: string,
  excludeProjectId?: string,
): ProjectIndexRow[] {
  return ctx.db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.organizationId, orgId))
    .all()
    .filter((project) => project.id !== excludeProjectId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildAutomatedIndexBlock(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  activeProjects: ProjectIndexRow[],
  deletedProjects: DeletedProjectEntry[],
): string {
  const lines = [AUTO_INDEX_START, "## Projects", "", "### Active", ""];

  if (activeProjects.length === 0) {
    lines.push("No active projects.");
  } else {
    for (const project of activeProjects) {
      const pageId = findOrCreateProjectKnowledgeBase(
        ctx,
        orgId,
        userId,
        project,
      ).id;
      lines.push(
        `- **${escapeMarkdownText(project.name)}**: [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/projects/${project.id}/wiki/${pageId})`,
      );
    }
  }

  if (deletedProjects.length > 0) {
    lines.push("", "### Deleted", "");
    for (const project of deletedProjects) {
      const wikiLink = project.pageId
        ? ` | [Knowledge Base](wiki://${project.pageId})`
        : "";
      lines.push(
        `- **${escapeMarkdownText(project.name)}**: deleted on ${project.deletedAt}${wikiLink}`,
      );
    }
  }

  lines.push("", AUTO_INDEX_END);
  return lines.join("\n");
}

function findProjectKnowledgeBase(
  ctx: WikiServiceContext,
  orgId: string,
  projectId: string,
): WikiPageRow | undefined {
  return ctx.db
    .select()
    .from(wikiPages)
    .where(
      and(
        eq(wikiPages.organizationId, orgId),
        eq(wikiPages.projectId, projectId),
        isNull(wikiPages.parentId),
      ),
    )
    .limit(1)
    .get();
}

function findOrCreateProjectKnowledgeBase(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  project: ProjectIndexRow,
): WikiPageDto {
  const existing = findProjectKnowledgeBase(ctx, orgId, project.id);
  if (existing) return toWikiPageDto(existing);

  return createTrackedWikiPage(ctx, orgId, userId, {
    title: "Knowledge Base",
    content: `# Knowledge Base\n\nDocumentation for project ${project.name} starts here.`,
    projectId: project.id,
    parentId: null,
  });
}

function markProjectKnowledgeBaseDeleted(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
): WikiPageDto {
  if (page.content.startsWith(DELETED_PROJECT_PREFIX)) {
    return toWikiPageDto(page);
  }

  return updateTrackedWikiPage(ctx, page, userId, {
    content: `${DELETED_PROJECT_PREFIX}\n\n${page.content}`,
  });
}

function upsertAutomatedIndexBlock(
  existingContent: string,
  automatedBlock: string,
): string {
  const start = existingContent.indexOf(AUTO_INDEX_START);
  const end = existingContent.indexOf(AUTO_INDEX_END);

  if (start !== -1 && end !== -1 && end > start) {
    return [
      existingContent.slice(0, start).trimEnd(),
      automatedBlock,
      existingContent.slice(end + AUTO_INDEX_END.length).trimStart(),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const contentWithoutLegacyBlock = removeLegacyProjectIndex(existingContent);
  if (!contentWithoutLegacyBlock.trim()) return automatedBlock;

  return `${contentWithoutLegacyBlock.trimEnd()}\n\n${automatedBlock}`;
}

function removeLegacyProjectIndex(content: string): string {
  return content
    .replace(
      /\n*## Projects\n\n[\s\S]*?\n\n---\n\n\*This index is managed by the organization\. You can edit additional notes below\.\*/m,
      "",
    )
    .trim();
}

function defaultOrganizationIndexContent(): string {
  return "# Organization Index";
}

function extractDeletedProjectEntries(content: string): DeletedProjectEntry[] {
  const start = content.indexOf(AUTO_INDEX_START);
  const end = content.indexOf(AUTO_INDEX_END);
  if (start === -1 || end === -1 || end <= start) return [];

  return content
    .slice(start, end)
    .split("\n")
    .map((line) =>
      line.match(
        /^- \*\*(.+)\*\*: deleted on (\d{4}-\d{2}-\d{2})(?: \| \[Knowledge Base\]\(wiki:\/\/([^)]+)\))?$/,
      ),
    )
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      name: unescapeMarkdownText(match[1] ?? ""),
      deletedAt: match[2] ?? "",
      pageId: match[3] ?? null,
    }));
}

function mergeDeletedProjectEntries(
  existingEntries: DeletedProjectEntry[],
  newEntry?: DeletedProjectEntry,
): DeletedProjectEntry[] {
  if (!newEntry) return existingEntries;
  return [
    ...existingEntries.filter(
      (entry) =>
        entry.pageId !== newEntry.pageId || entry.name !== newEntry.name,
    ),
    newEntry,
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function resolveIndexUserId(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
): string {
  if (userId) return userId;

  const firstMember = ctx.db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId))
    .limit(1)
    .get();

  if (!firstMember) {
    throw new Error("Cannot update organization wiki index without a member");
  }
  return firstMember.userId;
}

function createTrackedWikiPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  data: {
    title: string;
    content: string;
    slug?: string;
    projectId: string | null;
    parentId: string | null;
  },
): WikiPageDto {
  const id = uuidv4();
  const page = ctx.db
    .insert(wikiPages)
    .values({
      id,
      organizationId: orgId,
      projectId: data.projectId,
      parentId: data.parentId,
      title: data.title,
      slug: data.slug ?? generateWikiSlug(data.title),
      content: data.content,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()
    .get();

  if (!page) throw new Error("Failed to create wiki page");

  ctx.db
    .insert(wikiPageHistory)
    .values({
      id: uuidv4(),
      pageId: page.id,
      title: page.title,
      content: page.content,
      properties: page.properties,
      changedBy: userId,
    })
    .run();

  const dto = toWikiPageDto(page);
  ctx.broadcast(orgId, { type: "wiki.page_created", page: dto });
  return dto;
}

function updateTrackedWikiPage(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
  data: { content: string },
): WikiPageDto {
  const updated = ctx.db
    .update(wikiPages)
    .set({
      content: data.content,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(wikiPages.id, page.id))
    .returning()
    .get();

  if (!updated) throw new Error("Failed to update wiki page");

  ctx.db
    .insert(wikiPageHistory)
    .values({
      id: uuidv4(),
      pageId: updated.id,
      title: updated.title,
      content: updated.content,
      properties: updated.properties,
      changedBy: userId,
    })
    .run();

  const dto = toWikiPageDto(updated);
  ctx.broadcast(updated.organizationId, {
    type: "wiki.page_updated",
    page: dto,
  });
  return dto;
}

function formatDeletedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function escapeMarkdownText(text: string): string {
  return text.replace(/([\\*_`[\]])/g, "\\$1");
}

function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\*_`[\]])/g, "$1");
}
