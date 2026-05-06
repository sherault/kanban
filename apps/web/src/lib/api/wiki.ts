import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
  WikiHistoryDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";
import { apiFetch } from "./core";

export const wikiApi = {
  listPages(token: string, orgId: string) {
    return apiFetch<WikiPageSummaryDto[]>(
      `/organizations/${orgId}/wiki/pages`,
      {
        token,
      },
    );
  },
  createPage(token: string, orgId: string, body: CreateWikiPageDto) {
    return apiFetch<WikiPageDto>(`/organizations/${orgId}/wiki/pages`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
  },
  getPage(token: string, pageId: string) {
    return apiFetch<WikiPageDto>(`/wiki/pages/${pageId}`, { token });
  },
  updatePage(token: string, pageId: string, body: UpdateWikiPageDto) {
    return apiFetch<WikiPageDto>(`/wiki/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    });
  },
  deletePage(token: string, pageId: string) {
    return apiFetch<{ deleted: string }>(`/wiki/pages/${pageId}`, {
      method: "DELETE",
      token,
    });
  },
  getHistory(token: string, pageId: string) {
    return apiFetch<WikiHistoryDto[]>(`/wiki/pages/${pageId}/history`, {
      token,
    });
  },
};
