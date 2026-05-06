import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
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
  });

  const dto = toWikiPageDto(page!);
  ctx.broadcast(orgId, { type: "wiki.page_created", page: dto });
  return dto;
}

export async function updateWikiPage(
  ctx: WikiServiceContext,
  pageId: string,
  userId: string,
  data: UpdateWikiPageDto,
): Promise<WikiPageDto> {
  const existing = await getWikiPage(ctx, pageId);
  if (!existing) throw new Error("Page not found");

  const updateData: Partial<typeof wikiPages.$inferInsert> = {
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };

  if (data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = generateWikiSlug(data.title);
  }
  if (data.content !== undefined) updateData.content = data.content;
  if (data.properties !== undefined) {
    updateData.properties = stringifyProperties(data.properties);
  }
  if (data.parentId !== undefined) updateData.parentId = data.parentId;

  const [updated] = await ctx.db
    .update(wikiPages)
    .set(updateData)
    .where(eq(wikiPages.id, pageId))
    .returning();

  if (data.content !== undefined || data.title !== undefined) {
    await ctx.db.insert(wikiPageHistory).values({
      id: uuidv4(),
      pageId,
      title: updated!.title,
      content: updated!.content,
      properties: updated!.properties,
      changedBy: userId,
    });
  }

  const dto = toWikiPageDto(updated!);
  ctx.broadcast(existing.organizationId, {
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
  ctx.broadcast(existing.organizationId, { type: "wiki.page_deleted", pageId });
}
