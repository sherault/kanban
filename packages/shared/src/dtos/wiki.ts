export interface WikiPageDto {
  id: string;
  organizationId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  slug: string;
  content: string;
  properties?: Record<string, any> | null;
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
  properties?: Record<string, any> | null;
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
  properties?: Record<string, any> | null;
  parentId?: string | null | undefined;
  projectId?: string | null | undefined;
}

export interface UpdateWikiPageDto {
  title?: string | undefined;
  content?: string | undefined;
  properties?: Record<string, any> | null | undefined;
  parentId?: string | null | undefined;
}
