"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";
import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
  WikiHistoryListDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";
import { Column } from "@kanban/shared";

type SecondBrainCaptureInput = {
  title: string;
  content: string;
  parentId?: string | null;
  capturedFrom?: string;
  reviewAfter?: string;
  sourceUrls?: string[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function actionMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function arrayProperty(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mergeRelatedTaskId(
  properties: Record<string, unknown> | null | undefined,
  taskId: string,
): Record<string, unknown> {
  const relatedTaskIds = new Set([
    ...arrayProperty(properties?.["related_task_ids"]),
    taskId,
  ]);
  return {
    ...(properties ?? {}),
    related_task_ids: [...relatedTaskIds],
  };
}

function projectWikiPath(orgId: string, projectId: string) {
  return `/orgs/${orgId}/projects/${projectId}/wiki`;
}

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

export async function createSecondBrainCaptureAction(
  orgId: string,
  projectId: string,
  input: SecondBrainCaptureInput,
): Promise<{ error?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.createPage(token, orgId, {
      title: input.title,
      content: input.content,
      parentId: input.parentId ?? undefined,
      projectId,
      properties: {
        doc_type: "capture",
        status: "inbox",
        validation_status: "draft",
        source_status: "user_provided",
        captured_from: input.capturedFrom ?? "kanban_ui",
        review_after: input.reviewAfter || today(),
        source_urls: input.sourceUrls ?? [],
        related_wiki_ids: [],
        related_task_ids: [],
        rag: {
          include: true,
          retrieval_priority: "normal",
          chunking: "section",
        },
      },
    });
    revalidatePath(projectWikiPath(orgId, projectId));
    return { page };
  } catch (error) {
    return { error: actionMessage(error, "Failed to create capture") };
  }
}

export async function createTriageTaskForWikiPageAction(
  orgId: string,
  projectId: string,
  pageId: string,
): Promise<{ error?: string; taskId?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.getPage(token, pageId);
    const { data: task } = await api.tasks.create(token, projectId, {
      title: `Triage capture: ${page.title}`,
      column: Column.TODO,
      startDate: today(),
      endDate: today(),
      description: `Review [${page.title}](wiki://${page.id}) and promote it into durable wiki knowledge, actionable tasks, or a discarded capture note.`,
      objective: "Triage second-brain capture",
      backgroundColor: "#f97316",
      globalSubject: "Second Brain",
    });

    let taggedTask = task;
    for (const tag of ["capture", "inbox", "triage"]) {
      const result = await api.tasks.addTag(
        token,
        projectId,
        taggedTask.id,
        tag,
      );
      taggedTask = result.data;
    }

    const { data: updatedPage } = await api.wiki.updatePage(token, pageId, {
      properties: mergeRelatedTaskId(page.properties, taggedTask.id),
    });
    revalidatePath(projectWikiPath(orgId, projectId));
    return { taskId: taggedTask.id, page: updatedPage };
  } catch (error) {
    return { error: actionMessage(error, "Failed to create triage task") };
  }
}

export async function createFreshnessTaskForWikiPageAction(
  orgId: string,
  projectId: string,
  pageId: string,
): Promise<{ error?: string; taskId?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.getPage(token, pageId);
    const { data: task } = await api.tasks.create(token, projectId, {
      title: `Review freshness: ${page.title}`,
      column: Column.TODO,
      startDate: today(),
      endDate: today(),
      description: `Validate whether [${page.title}](wiki://${page.id}) is still current. Check source URLs, effective dates, jurisdiction, and citation requirements before marking it validated.`,
      objective: "Refresh second-brain knowledge",
      backgroundColor: "#0ea5e9",
      globalSubject: "Second Brain",
    });

    let taggedTask = task;
    for (const tag of ["freshness", "review", "second-brain"]) {
      const result = await api.tasks.addTag(
        token,
        projectId,
        taggedTask.id,
        tag,
      );
      taggedTask = result.data;
    }

    const properties = mergeRelatedTaskId(page.properties, taggedTask.id);
    const freshness =
      typeof properties["freshness"] === "object" &&
      properties["freshness"] !== null &&
      !Array.isArray(properties["freshness"])
        ? properties["freshness"]
        : {};

    const { data: updatedPage } = await api.wiki.updatePage(token, pageId, {
      properties: {
        ...properties,
        freshness: {
          ...freshness,
          status: "review_requested",
          review_task_id: taggedTask.id,
          requested_at: new Date().toISOString(),
        },
      },
    });
    revalidatePath(projectWikiPath(orgId, projectId));
    return { taskId: taggedTask.id, page: updatedPage };
  } catch (error) {
    return { error: actionMessage(error, "Failed to create freshness task") };
  }
}

export async function markWikiPageTriagedAction(
  orgId: string,
  projectId: string,
  pageId: string,
): Promise<{ error?: string; page?: WikiPageDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: page } = await api.wiki.getPage(token, pageId);
    const { data: updatedPage } = await api.wiki.updatePage(token, pageId, {
      properties: {
        ...(page.properties ?? {}),
        status: "triaged",
        triaged_at: new Date().toISOString(),
      },
    });
    revalidatePath(projectWikiPath(orgId, projectId));
    return { page: updatedPage };
  } catch (error) {
    return { error: actionMessage(error, "Failed to mark capture triaged") };
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
  limit = 20,
  offset = 0,
): Promise<{ error?: string; history?: WikiHistoryListDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: history } = await api.wiki.getHistory(
      token,
      pageId,
      limit,
      offset,
    );
    return { history };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load wiki history",
    };
  }
}
