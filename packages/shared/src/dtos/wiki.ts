export interface WikiPageDto {
  id: string;
  organizationId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  slug: string;
  content: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiHistoryDto {
  id: string;
  pageId: string;
  title: string;
  content: string;
  changedBy: string;
  changedByName?: string;
  createdAt: string;
}

export interface WikiPageSummaryDto {
  id: string;
  parentId: string | null;
  projectId: string | null;
  title: string;
  slug: string;
}

export interface CreateWikiPageDto {
  title: string;
  content: string;
  parentId?: string | null | undefined;
  projectId?: string | null | undefined;
}

export interface UpdateWikiPageDto {
  title?: string | undefined;
  content?: string | undefined;
  parentId?: string | null | undefined;
}
