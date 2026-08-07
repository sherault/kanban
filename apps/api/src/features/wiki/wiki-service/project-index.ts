import type { WikiPageDto } from "@kanban/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { memberships, projects } from "../../../db/schema/index.js";
import { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { WikiServiceContext } from "./context.js";
import { generateWikiSlug, toWikiPageDto } from "./mappers.js";

const AUTO_INDEX_START = "<!-- kanban:auto-project-index:start -->";
const AUTO_INDEX_END = "<!-- kanban:auto-project-index:end -->";
const DELETED_PROJECT_PREFIX = "[DELETED PROJECT]";
const ARCHIVED_NOTICE_START = "<!-- kanban:project-archived:start -->";
const ARCHIVED_NOTICE_END = "<!-- kanban:project-archived:end -->";

type ProjectIndexRow = Pick<typeof projects.$inferSelect, "id" | "name">;
type ArchivedProjectRow = ProjectIndexRow & { archivedAt: string };
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
  userId?: string,
): WikiPageDto {
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
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const topPage = findProjectKnowledgeBase(ctx, orgId, project.id, rootPage.id);
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

export function syncOrganizationIndexForProjectArchived(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
  archivedAt = new Date(),
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  // Sync first: it creates the knowledge base page when it does not exist yet.
  const indexPage = syncOrganizationIndex(ctx, orgId, actorId);
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const kbPage = findProjectKnowledgeBase(ctx, orgId, project.id, rootPage.id);
  if (kbPage) {
    upsertArchivedNotice(ctx, kbPage, actorId, formatDeletedAt(archivedAt));
  }
  return indexPage;
}

export function syncOrganizationIndexForProjectRestored(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const kbPage = findProjectKnowledgeBase(ctx, orgId, project.id, rootPage.id);
  if (kbPage) removeArchivedNotice(ctx, kbPage, actorId);
  return syncOrganizationIndex(ctx, orgId, actorId);
}

function syncOrganizationIndex(
  ctx: WikiServiceContext,
  orgId: string,
  userId?: string,
  options: SyncIndexOptions = {},
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  // Knowledge base pages are created as children of the index, so the index
  // page has to exist before the automated block is built.
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const liveProjects = listActiveProjects(ctx, orgId, options.excludeProjectId);
  const archivedProjects = listArchivedProjects(
    ctx,
    orgId,
    options.excludeProjectId,
  );
  const deletedProjects = mergeDeletedProjectEntries(
    extractDeletedProjectEntries(rootPage.content),
    options.deletedProject,
  );
  const content = upsertAutomatedIndexBlock(
    rootPage.content,
    buildAutomatedIndexBlock(
      ctx,
      orgId,
      actorId,
      rootPage.id,
      liveProjects,
      archivedProjects,
      deletedProjects,
    ),
  );

  if (rootPage.content === content) return toWikiPageDto(rootPage);

  return updateTrackedWikiPage(ctx, rootPage, actorId, { content });
}

function findOrCreateOrganizationIndexPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
): WikiPageRow {
  const existing = findOrganizationIndexPage(ctx, orgId);
  if (existing) return existing;

  createTrackedWikiPage(ctx, orgId, userId, {
    title: "Organization Index",
    slug: "root",
    content: defaultOrganizationIndexContent(),
    projectId: null,
    parentId: null,
  });

  const created = findOrganizationIndexPage(ctx, orgId);
  if (!created) throw new Error("Failed to create organization index page");
  return created;
}

export function findOrganizationIndexPage(
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
    .where(and(eq(projects.organizationId, orgId), isNull(projects.archivedAt)))
    .all()
    .filter((project) => project.id !== excludeProjectId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function listArchivedProjects(
  ctx: WikiServiceContext,
  orgId: string,
  excludeProjectId?: string,
): ArchivedProjectRow[] {
  return ctx.db
    .select({
      id: projects.id,
      name: projects.name,
      archivedAt: projects.archivedAt,
    })
    .from(projects)
    .where(
      and(eq(projects.organizationId, orgId), isNotNull(projects.archivedAt)),
    )
    .all()
    .filter((project) => project.id !== excludeProjectId)
    .map((project) => ({ ...project, archivedAt: project.archivedAt ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildAutomatedIndexBlock(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  rootPageId: string,
  activeProjects: ProjectIndexRow[],
  archivedProjects: ArchivedProjectRow[],
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
        rootPageId,
        project,
      ).id;
      lines.push(
        `- **${escapeMarkdownText(project.name)}**: [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/projects/${project.id}/wiki/${pageId})`,
      );
    }
  }

  if (archivedProjects.length > 0) {
    lines.push("", "### Archived", "");
    for (const project of archivedProjects) {
      const pageId = findOrCreateProjectKnowledgeBase(
        ctx,
        orgId,
        userId,
        rootPageId,
        project,
      ).id;
      lines.push(
        `- **${escapeMarkdownText(project.name)}**: archived on ${formatDeletedAt(new Date(project.archivedAt))} | [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/projects/${project.id}/wiki/${pageId})`,
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
  rootPageId: string,
): WikiPageRow | undefined {
  return ctx.db
    .select()
    .from(wikiPages)
    .where(
      and(
        eq(wikiPages.organizationId, orgId),
        eq(wikiPages.projectId, projectId),
        eq(wikiPages.parentId, rootPageId),
      ),
    )
    .limit(1)
    .get();
}

function findOrCreateProjectKnowledgeBase(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  rootPageId: string,
  project: ProjectIndexRow,
): WikiPageDto {
  const existing = findProjectKnowledgeBase(ctx, orgId, project.id, rootPageId);
  if (existing) return toWikiPageDto(existing);

  const title = projectKnowledgeBaseTitle(project.name);
  return createTrackedWikiPage(ctx, orgId, userId, {
    title,
    content: `# ${title}\n\nDocumentation for project ${project.name} starts here.`,
    projectId: project.id,
    parentId: rootPageId,
  });
}

function projectKnowledgeBaseTitle(projectName: string): string {
  return `KB: ${projectName}`;
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
  ctx.broadcast(`org:${orgId}`, { type: "wiki.page_created", page: dto });
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
  ctx.broadcast(`org:${updated.organizationId}`, {
    type: "wiki.page_updated",
    page: dto,
  });
  return dto;
}

function formatDeletedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildArchivedNotice(archivedOn: string): string {
  return [
    ARCHIVED_NOTICE_START,
    "<details>",
    "<summary>⚠️ Archived project</summary>",
    "",
    `This project was archived on ${archivedOn}.`,
    "",
    "</details>",
    ARCHIVED_NOTICE_END,
  ].join("\n");
}

function upsertArchivedNotice(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
  archivedOn: string,
): WikiPageDto {
  const notice = buildArchivedNotice(archivedOn);
  const stripped = stripArchivedNotice(page.content);
  const content = stripped ? `${notice}\n\n${stripped}` : notice;
  if (content === page.content) return toWikiPageDto(page);
  return updateTrackedWikiPage(ctx, page, userId, { content });
}

function removeArchivedNotice(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
): WikiPageDto {
  const content = stripArchivedNotice(page.content);
  if (content === page.content) return toWikiPageDto(page);
  return updateTrackedWikiPage(ctx, page, userId, { content });
}

function stripArchivedNotice(content: string): string {
  const start = content.indexOf(ARCHIVED_NOTICE_START);
  const end = content.indexOf(ARCHIVED_NOTICE_END);
  if (start === -1 || end === -1 || end < start) return content;
  // Remove exactly the "\n\n" separator upsertArchivedNotice inserted between
  // the notice and the rest of the content — not a blanket .trim(), which
  // would also eat whitespace that belongs to the user's own content.
  const before = content.slice(0, start);
  const after = content
    .slice(end + ARCHIVED_NOTICE_END.length)
    .replace(/^\n\n/, "");
  return `${before}${after}`;
}

function escapeMarkdownText(text: string): string {
  return text.replace(/([\\*_`[\]])/g, "\\$1");
}

function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\*_`[\]])/g, "$1");
}
