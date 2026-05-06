import { describe, expect, it } from "vitest";
import {
  generateWikiSlug,
  toWikiHistoryDto,
  toWikiPageDto,
} from "../../features/wiki/wiki-service/mappers.js";
import {
  toMembershipDto,
  toOrgDto,
} from "../../features/organization/organization-service/mappers.js";

describe("wiki service helpers", () => {
  it("normalizes wiki slugs and parses serialized properties", () => {
    expect(generateWikiSlug("Team Plan: Q2 / Launch")).toBe(
      "team-plan-q2-launch",
    );

    const dto = toWikiPageDto({
      id: "page-1",
      organizationId: "org-1",
      projectId: null,
      parentId: null,
      title: "Team Plan",
      slug: "team-plan",
      content: "# Plan",
      properties: '{"status":"draft"}',
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(dto.properties).toEqual({ status: "draft" });
  });

  it("maps history rows joined with users", () => {
    const dto = toWikiHistoryDto({
      wiki_page_history: {
        id: "history-1",
        pageId: "page-1",
        title: "Updated",
        content: "Body",
        properties: null,
        changedBy: "user-1",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      users: { displayName: "Alice" },
    } as Parameters<typeof toWikiHistoryDto>[0]);

    expect(dto.changedByName).toBe("Alice");
  });
});

describe("organization service helpers", () => {
  it("maps organization and member rows", () => {
    expect(
      toOrgDto({
        id: "org-1",
        name: "Acme",
        website: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      id: "org-1",
      name: "Acme",
      website: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(
      toMembershipDto({
        userId: "user-1",
        organizationId: "org-1",
        role: "manager",
        userEmail: "alice@example.com",
        userDisplayName: "Alice",
      }),
    ).toMatchObject({
      role: "manager",
      user: { id: "user-1", email: "alice@example.com" },
    });
  });
});
