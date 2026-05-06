import type { AppDb, Broadcaster } from "../../types.js";
import type {
  CreateWikiPageDto,
  UpdateWikiPageDto,
  WikiHistoryDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from "@kanban/shared";
import { noopBroadcaster } from "../../types.js";
import {
  deleteWikiPage,
  createWikiPage,
  updateWikiPage,
} from "./wiki-service/page-writes.js";
import {
  ensureRootWikiPage,
  getWikiHistory,
  getWikiPage,
  listWikiPages,
  searchWikiPages,
} from "./wiki-service/page-reads.js";

export class WikiService {
  constructor(
    readonly db: AppDb,
    readonly broadcast: Broadcaster = noopBroadcaster,
  ) {}

  async createPage(
    orgId: string,
    userId: string,
    data: CreateWikiPageDto & { slug?: string },
  ): Promise<WikiPageDto> {
    return createWikiPage(this, orgId, userId, data);
  }

  async updatePage(
    pageId: string,
    userId: string,
    data: UpdateWikiPageDto,
  ): Promise<WikiPageDto> {
    return updateWikiPage(this, pageId, userId, data);
  }

  async deletePage(pageId: string, _userId: string): Promise<void> {
    await deleteWikiPage(this, pageId);
  }

  async getPage(pageId: string): Promise<WikiPageDto | undefined> {
    return getWikiPage(this, pageId);
  }

  async listPages(
    orgId: string,
    userId?: string,
  ): Promise<WikiPageSummaryDto[]> {
    return listWikiPages(this, orgId, userId);
  }

  async ensureRootPage(orgId: string, userId: string): Promise<WikiPageDto> {
    return ensureRootWikiPage(this, orgId, userId);
  }

  async searchPages(
    orgId: string,
    query: string,
  ): Promise<WikiPageSummaryDto[]> {
    return searchWikiPages(this, orgId, query);
  }

  async getHistory(pageId: string): Promise<WikiHistoryDto[]> {
    return getWikiHistory(this, pageId);
  }
}
