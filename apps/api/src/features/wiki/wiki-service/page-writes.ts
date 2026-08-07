import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
  WikiEditSource,
  WikiPageDto,
} from "@kanban/shared";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { wikiPageHistory, wikiPages } from "../../../db/schema/wiki.js";
import type { WikiServiceContext } from "./context.js";
import { generateWikiSlug, toWikiPageDto } from "./mappers.js";
import { getWikiPage } from "./page-reads.js";

type CreateWikiPageInput = CreateWikiPageDto & { slug?: string };

function stringifyProperties(properties: unknown): string | null {
  return properties ? JSON.stringify(properties) : null;
}

export async function createWikiPage(
  ctx: WikiServiceContext,
  orgId: string,
  userId: string,
  data: CreateWikiPageInput,
  source: WikiEditSource = "web",
): Promise<WikiPageDto> {
  const id = uuidv4();
  const slug = data.slug ?? generateWikiSlug(data.title);

  const [page] = await ctx.db
    .insert(wikiPages)
    .values({
      id,
      organizationId: orgId,
      projectId: data.projectId ?? null,
      parentId: data.parentId ?? null,
      title: data.title,
      slug,
      content: data.content,
      properties: stringifyProperties(data.properties),
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  await ctx.db.insert(wikiPageHistory).values({
    id: uuidv4(),
    pageId: id,
    title: data.title,
    content: data.content,
    properties: stringifyProperties(data.properties),
    changedBy: userId,
    source,
  });

  const dto = toWikiPageDto(page!);
  ctx.broadcast(`org:${orgId}`, { type: "wiki.page_created", page: dto });
  return dto;
}

export async function updateWikiPage(
  ctx: WikiServiceContext,
  pageId: string,
  userId: string,
  data: UpdateWikiPageDto,
  source: WikiEditSource = "web",
): Promise<WikiPageDto> {
  const existing = await getWikiPage(ctx, pageId);
  if (!existing) throw new Error("Page not found");

  const titleChanged =
    data.title !== undefined && data.title !== existing.title;
  const contentChanged =
    data.content !== undefined && data.content !== existing.content;
  const propertiesChanged =
    data.properties !== undefined &&
    stringifyProperties(data.properties) !==
      stringifyProperties(existing.properties);
  const parentChanged =
    data.parentId !== undefined && data.parentId !== existing.parentId;

  // No-op save (autosave or forced): keep the page and its history untouched.
  if (
    !titleChanged &&
    !contentChanged &&
    !propertiesChanged &&
    !parentChanged
  ) {
    return existing;
  }

  const updateData: Partial<typeof wikiPages.$inferInsert> = {
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };

  if (titleChanged && data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = generateWikiSlug(data.title);
  }
  if (contentChanged && data.content !== undefined) {
    updateData.content = data.content;
  }
  if (propertiesChanged) {
    updateData.properties = stringifyProperties(data.properties);
  }
  if (parentChanged) updateData.parentId = data.parentId;

  const [updated] = await ctx.db
    .update(wikiPages)
    .set(updateData)
    .where(eq(wikiPages.id, pageId))
    .returning();

  if (titleChanged || contentChanged) {
    await ctx.db.insert(wikiPageHistory).values({
      id: uuidv4(),
      pageId,
      title: updated!.title,
      content: updated!.content,
      properties: updated!.properties,
      changedBy: userId,
      source,
    });
  }

  const dto = toWikiPageDto(updated!);
  ctx.broadcast(`org:${existing.organizationId}`, {
    type: "wiki.page_updated",
    page: dto,
  });
  return dto;
}

export async function deleteWikiPage(
  ctx: WikiServiceContext,
  pageId: string,
): Promise<void> {
  const existing = await getWikiPage(ctx, pageId);
  if (!existing) return;

  await ctx.db.delete(wikiPages).where(eq(wikiPages.id, pageId));
  ctx.broadcast(`org:${existing.organizationId}`, {
    type: "wiki.page_deleted",
    pageId,
  });
}
