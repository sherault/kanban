import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import * as schema from "../../db/schema/index.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  __dirname,
  "../../../drizzle/migrations/0015_org_scoped_wiki_links.sql",
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

async function seed() {
  const testDb = createTestDb();
  const orgSvc = new OrganizationService(testDb.db);
  const projectSvc = new ProjectService(testDb.db);
  const user = await createVerifiedUser(testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const alpha = projectSvc.createProject(org.id, { name: "Alpha" }, user.id);
  const beta = projectSvc.createProject(org.id, { name: "Beta" }, user.id);
  return { testDb, user, org, alpha, beta };
}

function insertPage(
  db: ReturnType<typeof createTestDb>["db"],
  page: { id: string; orgId: string; userId: string; content: string },
) {
  db.insert(schema.wikiPages)
    .values({
      id: page.id,
      organizationId: page.orgId,
      title: page.id,
      slug: page.id,
      content: page.content,
      createdBy: page.userId,
      updatedBy: page.userId,
    })
    .run();
}

function contentOf(
  db: ReturnType<typeof createTestDb>["db"],
  id: string,
): string {
  const row = db
    .select()
    .from(schema.wikiPages)
    .where(sql`${schema.wikiPages.id} = ${id}`)
    .get();
  return row!.content;
}

describe("0015_org_scoped_wiki_links", () => {
  it("rewrites project-scoped wiki links and preserves everything else", async () => {
    const { testDb, user, org, alpha, beta } = await seed();

    insertPage(testDb.db, {
      id: "page-1",
      orgId: org.id,
      userId: user.id,
      content: [
        `[A](/orgs/${org.id}/projects/${alpha.id}/wiki/page-a)`,
        `[B](/orgs/${org.id}/projects/${beta.id}/wiki/page-b)`,
        `[Root](/orgs/${org.id}/projects/${alpha.id}/wiki)`,
        `[Board](/orgs/${org.id}/projects/${alpha.id})`,
        `[Deleted](wiki://page-c)`,
        `[Other org](/orgs/other-org/projects/other-project/wiki/page-d)`,
      ].join("\n"),
    });

    testDb.db.run(sql.raw(migrationSql()));
    const content = contentOf(testDb.db, "page-1");

    expect(content).toContain(`[A](/orgs/${org.id}/wiki/page-a)`);
    expect(content).toContain(`[B](/orgs/${org.id}/wiki/page-b)`);
    expect(content).toContain(`[Root](/orgs/${org.id}/wiki)`);
    expect(content).toContain(`[Board](/orgs/${org.id}/projects/${alpha.id})`);
    expect(content).toContain(`[Deleted](wiki://page-c)`);
    expect(content).toContain(
      `[Other org](/orgs/other-org/projects/other-project/wiki/page-d)`,
    );
    testDb.close();
  });

  it("is idempotent", async () => {
    const { testDb, user, org, alpha } = await seed();

    insertPage(testDb.db, {
      id: "page-1",
      orgId: org.id,
      userId: user.id,
      content: `[A](/orgs/${org.id}/projects/${alpha.id}/wiki/page-a)`,
    });

    testDb.db.run(sql.raw(migrationSql()));
    const once = contentOf(testDb.db, "page-1");
    testDb.db.run(sql.raw(migrationSql()));
    const twice = contentOf(testDb.db, "page-1");

    expect(twice).toBe(once);
    testDb.close();
  });

  it("leaves wiki_page_history untouched", async () => {
    const { testDb, user, org, alpha } = await seed();
    const legacy = `[A](/orgs/${org.id}/projects/${alpha.id}/wiki/page-a)`;

    insertPage(testDb.db, {
      id: "page-1",
      orgId: org.id,
      userId: user.id,
      content: legacy,
    });
    testDb.db
      .insert(schema.wikiPageHistory)
      .values({
        id: "rev-1",
        pageId: "page-1",
        title: "page-1",
        content: legacy,
        changedBy: user.id,
      })
      .run();

    testDb.db.run(sql.raw(migrationSql()));
    const revision = testDb.db
      .select()
      .from(schema.wikiPageHistory)
      .where(sql`${schema.wikiPageHistory.id} = 'rev-1'`)
      .get();

    expect(revision!.content).toBe(legacy);
    testDb.close();
  });
});
