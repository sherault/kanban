import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { AppDb, Broadcaster } from "../../types.js";
import { wikiPages, wikiPageHistory } from "../../db/schema/wiki.js";
import { memberships, users } from "../../db/schema/index.js";
import type {
  WikiPageDto,
  WikiHistoryDto,
  WikiPageSummaryDto,
  CreateWikiPageDto,
  UpdateWikiPageDto,
} from "@kanban/shared";
import { noopBroadcaster } from "../../types.js";

export class WikiService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster,
  ) {}

  private toPageDto(row: typeof wikiPages.$inferSelect): WikiPageDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      projectId: row.projectId,
      parentId: row.parentId,
      title: row.title,
      slug: row.slug,
      content: row.content,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toHistoryDto(row: any): WikiHistoryDto {
    const historyRow = row.wiki_page_history || row;
    const userRow = row.users;
    return {
      id: historyRow.id,
      pageId: historyRow.pageId,
      title: historyRow.title,
      content: historyRow.content,
      changedBy: historyRow.changedBy,
      changedByName: userRow?.displayName,
      createdAt: historyRow.createdAt,
    };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async createPage(
    orgId: string,
    userId: string,
    data: CreateWikiPageDto & { slug?: string },
  ): Promise<WikiPageDto> {
    const id = uuidv4();
    const slug = data.slug ?? this.generateSlug(data.title);

    const [page] = await this.db
      .insert(wikiPages)
      .values({
        id,
        organizationId: orgId,
        projectId: data.projectId ?? null,
        parentId: data.parentId ?? null,
        title: data.title,
        slug,
        content: data.content,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Initial history entry
    await this.db.insert(wikiPageHistory).values({
      id: uuidv4(),
      pageId: id,
      title: data.title,
      content: data.content,
      changedBy: userId,
    });

    this.broadcast(orgId, {
      type: "wiki.page_created",
      page: this.toPageDto(page!),
    });
    return this.toPageDto(page!);
  }

  async updatePage(
    pageId: string,
    userId: string,
    data: UpdateWikiPageDto,
  ): Promise<WikiPageDto> {
    const existing = await this.getPage(pageId);
    if (!existing) throw new Error("Page not found");

    const updateData: Partial<typeof wikiPages.$inferInsert> = {
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
      updateData.slug = this.generateSlug(data.title);
    }
    if (data.content !== undefined) {
      updateData.content = data.content;
    }
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId;
    }

    const [updated] = await this.db
      .update(wikiPages)
      .set(updateData)
      .where(eq(wikiPages.id, pageId))
      .returning();

    if (data.content !== undefined || data.title !== undefined) {
      await this.db.insert(wikiPageHistory).values({
        id: uuidv4(),
        pageId,
        title: updated!.title,
        content: updated!.content,
        changedBy: userId,
      });
    }

    this.broadcast(existing.organizationId, {
      type: "wiki.page_updated",
      page: this.toPageDto(updated!),
    });

    return this.toPageDto(updated!);
  }

  async deletePage(pageId: string, _userId: string): Promise<void> {
    const existing = await this.getPage(pageId);
    if (!existing) return;

    await this.db.delete(wikiPages).where(eq(wikiPages.id, pageId));

    this.broadcast(existing.organizationId, {
      type: "wiki.page_deleted",
      pageId,
    });
  }

  async getPage(pageId: string): Promise<WikiPageDto | undefined> {
    const [row] = await this.db
      .select()
      .from(wikiPages)
      .where(eq(wikiPages.id, pageId))
      .limit(1);

    return row ? this.toPageDto(row) : undefined;
  }

  async listPages(
    orgId: string,
    userId?: string,
  ): Promise<WikiPageSummaryDto[]> {
    const rows = await this.db
      .select({
        id: wikiPages.id,
        parentId: wikiPages.parentId,
        projectId: wikiPages.projectId,
        title: wikiPages.title,
        slug: wikiPages.slug,
      })
      .from(wikiPages)
      .where(eq(wikiPages.organizationId, orgId));

    if (rows.length === 0) {
      // Create root page automatically if it doesn't exist
      // If no userId provided (e.g. from a background task or systemic call),
      // we'll need to find a valid user in the organization to avoid FK constraint issues.
      let creatorId = userId;
      if (!creatorId) {
        const [firstMember] = await this.db
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(eq(memberships.organizationId, orgId))
          .limit(1);
        creatorId = firstMember?.userId || "unknown"; // "unknown" might still fail if not in users table
      }

      await this.ensureRootPage(orgId, creatorId);
      return this.listPages(orgId, userId);
    }

    return rows;
  }

  async ensureRootPage(orgId: string, userId: string): Promise<WikiPageDto> {
    const [existing] = await this.db
      .select()
      .from(wikiPages)
      .where(
        and(eq(wikiPages.organizationId, orgId), eq(wikiPages.slug, "root")),
      )
      .limit(1);

    if (existing) return this.toPageDto(existing);

    // Get projects to list them
    const projectRows = await this.db.query.projects.findMany({
      where: (p, { eq }) => eq(p.organizationId, orgId),
    });

    let content = "# Organization Knowledge Base\n\n## Projects\n\n";
    for (const p of projectRows) {
      // Find or create a page for this project
      const [projectPage] = await this.db
        .select()
        .from(wikiPages)
        .where(
          and(
            eq(wikiPages.projectId, p.id),
            eq(wikiPages.organizationId, orgId),
          ),
        )
        .limit(1);

      let pageId = projectPage?.id;
      if (!projectPage) {
        const newPage = await this.createPage(orgId, userId, {
          title: `${p.name} Knowledge Base`,
          content: `# ${p.name}\n\nDocumentation for project ${p.name} starts here.`,
          projectId: p.id,
          parentId: null, // Top level under organization root
        });
        pageId = newPage.id;
      }

      content += `- **${p.name}**: [Board](/orgs/${orgId}/projects/${p.id}) | [Wiki Page](/orgs/${orgId}/projects/${p.id}?page=${pageId})\n`;
    }
    content +=
      "\n---\n\n*This index is managed by the organization. You can edit additional notes below.*";

    return this.createPage(orgId, userId, {
      title: "Organization Index",
      content,
      slug: "root",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  async searchPages(
    orgId: string,
    query: string,
  ): Promise<WikiPageSummaryDto[]> {
    const rows = await this.db
      .select({
        id: wikiPages.id,
        parentId: wikiPages.parentId,
        projectId: wikiPages.projectId,
        title: wikiPages.title,
        slug: wikiPages.slug,
      })
      .from(wikiPages)
      .where(
        and(
          eq(wikiPages.organizationId, orgId),
          // Simple case-insensitive search if supported, otherwise just title/content like
          // Drizzle doesn't have a cross-platform 'ilike' yet, but 'like' works for simple cases
          // or we can use custom sql
        ),
      );

    const filtered = rows.filter((r) =>
      r.title.toLowerCase().includes(query.toLowerCase()),
    );

    return filtered;
  }

  async getHistory(pageId: string): Promise<WikiHistoryDto[]> {
    const rows = await this.db
      .select()
      .from(wikiPageHistory)
      .leftJoin(users, eq(wikiPageHistory.changedBy, users.id))
      .where(eq(wikiPageHistory.pageId, pageId))
      .orderBy(desc(wikiPageHistory.createdAt));

    return rows.map((r) => this.toHistoryDto(r));
  }
}
