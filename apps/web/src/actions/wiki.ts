"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";
import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
  WikiHistoryDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";

export async function listWikiPagesAction(
  orgId: string,
): Promise<{ error?: string; pages?: WikiPageSummaryDto[] }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: pages } = await api.wiki.listPages(token, orgId);
    return { pages };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load wiki pages",
    };
  }
}

export async function createWikiPageAction(
  orgId: string,
  body: CreateWikiPageDto,
): Promise<{ error?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.createPage(token, orgId, body);
    revalidatePath(`/orgs/${orgId}`);
    return { page };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create wiki page",
    };
  }
}

export async function getWikiPageAction(
  pageId: string,
): Promise<{ error?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.getPage(token, pageId);
    return { page };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load wiki page",
    };
  }
}

export async function updateWikiPageAction(
  pageId: string,
  body: UpdateWikiPageDto,
): Promise<{ error?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.updatePage(token, pageId, body);
    return { page };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update wiki page",
    };
  }
}

export async function deleteWikiPageAction(
  pageId: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    await api.wiki.deletePage(token, pageId);
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to delete wiki page",
    };
  }
}

export async function getWikiHistoryAction(
  pageId: string,
): Promise<{ error?: string; history?: WikiHistoryDto[] }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: history } = await api.wiki.getHistory(token, pageId);
    return { history };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load wiki history",
    };
  }
}
