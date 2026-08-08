# Org-Scoped Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the web wiki from `/orgs/[orgId]/projects/[projectId]/wiki/[wikiPageId]` to `/orgs/[orgId]/wiki/[wikiPageId]`, matching the org-scoped data model, while keeping the Board↔Wiki header switch and the board's `Cmd+K` wiki search.

**Architecture:** `WikiProvider` moves up from `ProjectClientLayout` to `orgs/[orgId]/layout.tsx` (through a thin client shell) so board and wiki share one page list. The wiki gets its own route subtree with its own server layout; all wiki components physically move there and lose their `projectId` prop. The Board↔Wiki switch is backed by a per-tab `sessionStorage` entry holding the org's active project. Old project-scoped URLs `permanentRedirect` to the new shape. A hand-written SQL migration rewrites project-scoped wiki links already stored in page content; `MarkdownLink` also parses the legacy shape so old revisions stay clickable.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19 hooks, Hono + Drizzle + better-sqlite3 on the API, Vitest (API only — `apps/web` has no test setup).

## Global Constraints

- Route target: `/orgs/[orgId]/wiki` and `/orgs/[orgId]/wiki/[wikiPageId]`. Never emit `/orgs/X/projects/Y/wiki/...` in new code.
- No database schema change. `wiki_pages.project_id` keeps its current meaning.
- No change to the API surface (`POST/GET /organizations/:orgId/wiki/pages`, `GET/PATCH/DELETE /wiki/pages/:id`) or to the MCP wiki tools.
- `wiki_page_history` is **not** migrated — it is a revision journal.
- Deleted-project entries in the org index keep the `wiki://<id>` form.
- Session storage key: `kanban_active_project_<orgId>`, on `sessionStorage` (per browser tab).
- Old URLs redirect permanently and the redirect is kept indefinitely.
- Cross-org wiki links stay disabled (`DisabledLink`) in `MarkdownLink`.
- `apps/api` tests run with `cd apps/api && pnpm test`. `apps/web` is verified with `pnpm --filter @kanban/web build` and `pnpm lint`.
- Commit after every task. Conventional Commits, subject ≤50 chars.

## Deviations from the spec (decided while planning, apply as written)

1. **Redirect seeding uses a query param, not a cookie.** The spec asks the old wiki pages to set a short-lived cookie carrying `projectId`. A Next server component cannot call `cookies().set()` — only route handlers and server actions can, and a `route.ts` cannot coexist with the `page.tsx` at that path. The redirect therefore appends `?from=<projectId>`, and the wiki layout seeds `sessionStorage` from it. Same effect, no cookie.
2. **`WikiClient` is rendered by the wiki layout, not by the pages.** The spec wanted the `page.tsx` files to render. Rendering `WikiClient` from the page remounts it on every `/wiki` ↔ `/wiki/<id>` navigation, re-running the tab-restore effect against a URL that has already changed — exactly the class of bug the current code works around. The layout owns `WikiClient`; it reads `wikiPageId` from `useParams()` as it does today; the two `page.tsx` files return `null`. The `isWikiRoute` pathname guard still goes away, because the wiki is no longer mounted next to the board.
3. **Task links from the wiki need a navigation (Task 11).** Today `MarkdownLink` opens a task by dispatching `kanban_open_task` without navigating, which only works because the board is mounted behind the wiki. Once the wiki is a separate route, the board is not mounted, so the event is lost. Task 11 makes the link navigate to `/orgs/X/projects/Y?taskId=<id>` and teaches `BoardClient` to open that panel on mount. The spec does not list this; without it, task links in wiki pages silently do nothing.
4. **`MarkdownLink` must also match the new org-scoped shape.** The spec only mentions keeping the legacy shape. After the migration, stored links are org-scoped, so the new shape needs a matcher too. Both are implemented in Task 8.

---

## File Structure

**API (`apps/api`)**

| File                                                         | Responsibility                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `src/features/wiki/wiki-service/project-index.ts` (modify)   | Emit `[Knowledge Base](/orgs/X/wiki/Z)` in the auto index      |
| `src/tests/features/wiki.service.test.ts` (modify)           | Assert the new link shape; assert index regeneration is stable |
| `drizzle/migrations/0015_org_scoped_wiki_links.sql` (create) | Rewrite project-scoped wiki links in `wiki_pages.content`      |
| `drizzle/migrations/meta/_journal.json` (modify)             | Register migration 15                                          |
| `src/tests/db/wiki-link-migration.test.ts` (create)          | Replay the migration over seeded rows and assert the rewrite   |

**Web (`apps/web/src`)**

| File                                                                                                                    | Responsibility                                            |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `lib/activeProjectSession.ts` (create)                                                                                  | Read/write the per-tab active project                     |
| `app/(app)/orgs/[orgId]/layout.tsx` (modify)                                                                            | Server layout; wraps children in the wiki provider shell  |
| `app/(app)/orgs/[orgId]/OrgWikiProviderShell.tsx` (create)                                                              | Client: `WikiProvider`, page fetch, refresh listener      |
| `app/(app)/orgs/[orgId]/wiki/layout.tsx` (create)                                                                       | Server: token, projects, user prefs → `OrgWikiLayout`     |
| `app/(app)/orgs/[orgId]/wiki/OrgWikiLayout.tsx` (create)                                                                | Client: sidebar + `WikiClient`, owns the selected project |
| `app/(app)/orgs/[orgId]/wiki/page.tsx`, `wiki/[wikiPageId]/page.tsx` (create)                                           | Route leaves                                              |
| `app/(app)/orgs/[orgId]/wiki/WikiClient.tsx`, `WikiSidebar.tsx`, `wiki-sidebar/**` (moved)                              | The wiki UI, org-scoped                                   |
| `app/(app)/orgs/[orgId]/projects/[projectId]/wiki/**` (modify)                                                          | Permanent redirects to the new URLs                       |
| `app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx` (modify)                                          | Board only; writes the active project to the session      |
| `app/(app)/orgs/[orgId]/projects/[projectId]/project-layout/ProjectContentArea.tsx` (modify)                            | Renders `BoardClient` only                                |
| `app/(app)/orgs/[orgId]/projects/[projectId]/project-layout/ProjectSearchOverlay.tsx` (modify)                          | Org-scoped wiki result URLs                               |
| `components/HeaderTabs.tsx` (modify)                                                                                    | Session-backed Board↔Wiki switch                          |
| `components/wiki-editor/MarkdownLink.tsx` (modify)                                                                      | Org-scoped targets, legacy parsing, task navigation       |
| `components/wiki-editor/MarkdownPreview.tsx`, `WikiEditorSurface.tsx`, `types.ts`, `components/WikiEditor.tsx` (modify) | Drop the `projectId` prop                                 |
| `actions/wiki.ts` (modify)                                                                                              | `orgWikiPath(orgId)` replaces `projectWikiPath`           |

---

## Task 1: API — org index emits org-scoped Knowledge Base links

**Files:**

- Modify: `apps/api/src/features/wiki/wiki-service/project-index.ts` (the two `[Knowledge Base](...)` lines inside `buildAutomatedIndexBlock`)
- Test: `apps/api/src/tests/features/wiki.service.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: org index content of the form
  `- **Name**: [Board](/orgs/<orgId>/projects/<projectId>) | [Knowledge Base](/orgs/<orgId>/wiki/<pageId>)`
  (archived variant is prefixed by `archived on <date> | `). Deleted entries keep `[Knowledge Base](wiki://<pageId>)`.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/tests/features/wiki.service.test.ts`, inside `describe("WikiService page operations", ...)`, add:

```ts
it("links project knowledge bases with org-scoped wiki urls", async () => {
  const { testDb, wikiSvc, user, org, project } = await setup();

  const root = await wikiSvc.ensureRootPage(org.id, user.id);
  const pages = await wikiSvc.listPages(org.id, user.id);
  const kbPage = pages.find((page) => page.projectId === project.id);

  expect(kbPage).toBeTruthy();
  expect(root.content).toContain(
    `[Board](/orgs/${org.id}/projects/${project.id})`,
  );
  expect(root.content).toContain(
    `[Knowledge Base](/orgs/${org.id}/wiki/${kbPage!.id})`,
  );
  expect(root.content).not.toContain(
    `/orgs/${org.id}/projects/${project.id}/wiki/`,
  );
  testDb.close();
});

it("regenerating the organization index produces no diff", async () => {
  const { testDb, wikiSvc, user, org } = await setup();

  const first = await wikiSvc.ensureRootPage(org.id, user.id);
  await wikiSvc.listPages(org.id, user.id);
  const second = await wikiSvc.ensureRootPage(org.id, user.id);

  expect(second.content).toBe(first.content);
  testDb.close();
});
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `cd apps/api && pnpm vitest run src/tests/features/wiki.service.test.ts -t "org-scoped wiki urls"`
Expected: FAIL — the index still contains `/orgs/<org>/projects/<project>/wiki/<page>`.

- [ ] **Step 3: Change the two link lines**

In `buildAutomatedIndexBlock`, replace the active-project line:

```ts
lines.push(
  `- **${escapeMarkdownText(project.name)}**: [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/wiki/${pageId})`,
);
```

and the archived-project line:

```ts
lines.push(
  `- **${escapeMarkdownText(project.name)}**: archived on ${formatDeletedAt(new Date(project.archivedAt))} | [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/wiki/${pageId})`,
);
```

Leave the deleted-project branch (`wiki://${project.pageId}`) untouched.

- [ ] **Step 4: Run the whole wiki suite**

Run: `cd apps/api && pnpm vitest run src/tests/features/wiki.service.test.ts src/tests/features/wiki-project-archive.test.ts src/tests/features/mcp-wiki-tools.test.ts`
Expected: PASS. If an older assertion asserted the project-scoped KB link, update it to the org-scoped shape — do not weaken it to a substring that matches both.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/wiki/wiki-service/project-index.ts apps/api/src/tests/features/wiki.service.test.ts
git commit -m "feat(api): org-scoped KB links in org index"
```

---

## Task 2: API — data migration rewriting stored wiki links

**Files:**

- Create: `apps/api/drizzle/migrations/0015_org_scoped_wiki_links.sql`
- Modify: `apps/api/drizzle/migrations/meta/_journal.json`
- Test: `apps/api/src/tests/db/wiki-link-migration.test.ts` (new; note tests live under `src/tests/`, not `tests/`)

**Interfaces:**

- Consumes: nothing.
- Produces: migration tag `0015_org_scoped_wiki_links`, idempotent, rewrites `wiki_pages.content` only. `wiki_page_history` untouched.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/db/wiki-link-migration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm vitest run src/tests/db/wiki-link-migration.test.ts`
Expected: FAIL — `ENOENT` on `0015_org_scoped_wiki_links.sql`.

- [ ] **Step 3: Write the migration**

Create `apps/api/drizzle/migrations/0015_org_scoped_wiki_links.sql` with exactly one statement (no `--> statement-breakpoint`, so the file can be replayed with a single `run`):

```sql
-- Rewrite project-scoped wiki links in page content to org-scoped ones
WITH RECURSIVE
  numbered AS (
    SELECT p.id AS project_id, p.organization_id AS org_id,
           ROW_NUMBER() OVER (PARTITION BY p.organization_id ORDER BY p.id) AS rn
    FROM `projects` p
  ),
  folded(page_id, org_id, step, content) AS (
    SELECT w.id, w.organization_id, 0, w.content FROM `wiki_pages` w
    UNION ALL
    SELECT f.page_id, f.org_id, f.step + 1,
      replace(
        replace(f.content,
                '/orgs/' || f.org_id || '/projects/' || n.project_id || '/wiki/',
                '/orgs/' || f.org_id || '/wiki/'),
        '/orgs/' || f.org_id || '/projects/' || n.project_id || '/wiki',
        '/orgs/' || f.org_id || '/wiki')
    FROM folded f
    JOIN numbered n ON n.org_id = f.org_id AND n.rn = f.step + 1
  ),
  final AS (
    SELECT page_id, content FROM folded f
    WHERE f.step = (SELECT MAX(step) FROM folded g WHERE g.page_id = f.page_id)
  )
UPDATE `wiki_pages` SET `content` = (SELECT content FROM final WHERE final.page_id = `wiki_pages`.`id`)
WHERE EXISTS (SELECT 1 FROM final WHERE final.page_id = `wiki_pages`.`id`);
```

The recursive CTE folds one `replace` pair per project of the page's own organization, so a page linking several projects is fully rewritten. The nested `replace` handles the bare `.../wiki` root link after the inner call has consumed the `.../wiki/<id>` form.

- [ ] **Step 4: Register the migration in the journal**

In `apps/api/drizzle/migrations/meta/_journal.json`, append after the `0014_massive_microchip` entry (mind the comma on the previous entry):

```json
{
  "idx": 15,
  "version": "6",
  "when": 1786190400000,
  "tag": "0015_org_scoped_wiki_links",
  "breakpoints": true
}
```

- [ ] **Step 5: Run the migration test**

Run: `cd apps/api && pnpm vitest run src/tests/db/wiki-link-migration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full API suite**

Run: `cd apps/api && pnpm test`
Expected: PASS. `createTestDb()` now applies 16 migrations; nothing else should move.

- [ ] **Step 7: Commit**

```bash
git add apps/api/drizzle/migrations/0015_org_scoped_wiki_links.sql apps/api/drizzle/migrations/meta/_journal.json apps/api/src/tests/db/wiki-link-migration.test.ts
git commit -m "feat(api): migrate wiki links to org scope"
```

---

## Task 3: Web — active-project session storage and `orgWikiPath`

**Files:**

- Create: `apps/web/src/lib/activeProjectSession.ts`
- Modify: `apps/web/src/actions/wiki.ts` (lines 53-55 and the four `revalidatePath(projectWikiPath(...))` call sites)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `readActiveProject(orgId: string): string | null`
  - `writeActiveProject(orgId: string, projectId: string): void`
  - `orgWikiPath(orgId: string): string` (module-private in `actions/wiki.ts`)

- [ ] **Step 1: Write the session module**

Create `apps/web/src/lib/activeProjectSession.ts`:

```ts
const STORAGE_PREFIX = "kanban_active_project_";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}

/**
 * The org's active project, per browser tab. Backs the Board tab target while
 * the user is in the org-level wiki, and the Second Brain project selector.
 * Read it from event handlers or effects only — never during render, or the
 * server and client markup disagree.
 */
export function readActiveProject(orgId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(storageKey(orgId));
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeActiveProject(orgId: string, projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(orgId), projectId);
  } catch {
    // Quota or privacy mode — the Board tab just falls back to the org page.
  }
}
```

- [ ] **Step 2: Switch the revalidate path in `actions/wiki.ts`**

Replace the helper:

```ts
function orgWikiPath(orgId: string) {
  return `/orgs/${orgId}/wiki`;
}
```

Then change the four call sites — in `createSecondBrainCaptureAction`, `createTriageTaskForWikiPageAction`, `createFreshnessTaskForWikiPageAction`, and `markWikiPageTriagedAction` — from `revalidatePath(projectWikiPath(orgId, projectId))` to:

```ts
revalidatePath(orgWikiPath(orgId));
```

Keep every action's `projectId` parameter: those actions create tasks in a project.

- [ ] **Step 3: Type-check**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS (no `projectWikiPath` references left; `projectId` is still used by the API calls in each action).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/activeProjectSession.ts apps/web/src/actions/wiki.ts
git commit -m "feat(web): add active-project session storage"
```

---

## Task 4: Web — `WikiProvider` moves to the org layout

**Files:**

- Create: `apps/web/src/app/(app)/orgs/[orgId]/OrgWikiProviderShell.tsx`
- Modify: `apps/web/src/app/(app)/orgs/[orgId]/layout.tsx`
- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx` (drop its own `WikiProvider` wrapper and its `fetchPages` / `kanban_wiki_page_updated` listener)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `OrgWikiProviderShell({ orgId, children }: { orgId: string; children: React.ReactNode })` — mounts `WikiProvider`, fetches pages once on mount, and refetches on the `kanban_wiki_page_updated` window event.
  - Contract for the rest of the app: **dispatching `new Event("kanban_wiki_page_updated")` is the way to refresh the wiki page list.** No component receives a `fetchPages` callback from above any more.

- [ ] **Step 1: Write the shell**

Create `apps/web/src/app/(app)/orgs/[orgId]/OrgWikiProviderShell.tsx`:

```tsx
"use client";

import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { listWikiPagesAction } from "@/actions/wiki";
import { WikiProvider, useWiki } from "@/context/WikiContext";

/**
 * The wiki page list is shared by the board (Cmd+K search) and the wiki route,
 * so it lives at the org layout. The fetch stays client-side: putting it in the
 * server layout would add a wiki round-trip to every org route render.
 */
export function OrgWikiProviderShell({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  return (
    <WikiProvider orgId={orgId}>
      <OrgWikiPagesLoader orgId={orgId}>{children}</OrgWikiPagesLoader>
    </WikiProvider>
  );
}

function OrgWikiPagesLoader({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  const { setPages, setIsLoading } = useWiki();

  const fetchPages = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await listWikiPagesAction(orgId);
      if (result.pages) setPages(result.pages);
    } catch (e) {
      console.error("Failed to fetch wiki pages", e);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, setIsLoading, setPages]);

  useEffect(() => {
    const refresh = () => {
      void fetchPages();
    };
    window.addEventListener("kanban_wiki_page_updated", refresh);
    void fetchPages();
    return () => {
      window.removeEventListener("kanban_wiki_page_updated", refresh);
    };
  }, [fetchPages]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Mount it in the org layout**

Replace the whole of `apps/web/src/app/(app)/orgs/[orgId]/layout.tsx`:

```tsx
import { OrgWikiProviderShell } from "./OrgWikiProviderShell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgWikiProviderShell orgId={orgId}>{children}</OrgWikiProviderShell>;
}
```

- [ ] **Step 3: Remove the duplicate provider from `ProjectClientLayout`**

In `ProjectClientLayout.tsx`:

- Delete the `ProjectClientLayout` wrapper component that renders `<WikiProvider>` and rename `ProjectClientLayoutInner` to `ProjectClientLayout` (keep the export name — `layout.tsx` imports `{ ProjectClientLayout }`).
- Delete the `fetchPages` callback and the `window.addEventListener("kanban_wiki_page_updated", fetchPages)` registration plus the `void fetchPages()` call in that effect, and drop `fetchPages` from the effect's dependency array (it becomes `[]`).
- Keep `const { pages } = useWiki();` for the `Cmd+K` filter, drop `setPages` / `setIsLoading` from the destructuring.
- Drop the `WikiProvider` and `listWikiPagesAction` imports.
- The `<WikiSidebar ... onRefresh={fetchPages} />` branch keeps compiling for now — pass `onRefresh={() => window.dispatchEvent(new Event("kanban_wiki_page_updated"))}`; Task 5 deletes that branch entirely.

- [ ] **Step 4: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/OrgWikiProviderShell.tsx" "apps/web/src/app/(app)/orgs/[orgId]/layout.tsx" "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx"
git commit -m "refactor(web): host WikiProvider at org layout"
```

---

## Task 5: Web — move the wiki components to the org route

This is the pivot task: the files move and every project-scoped wiki URL inside them becomes org-scoped, in one commit, because the build cannot be green halfway through.

**Files:**

- Move (`git mv`), from `app/(app)/orgs/[orgId]/projects/[projectId]/` to `app/(app)/orgs/[orgId]/wiki/`:
  `WikiClient.tsx`, `WikiSidebar.tsx`, and the whole `wiki-sidebar/` directory (13 files + `second-brain/` 6 files).
- Create: `app/(app)/orgs/[orgId]/wiki/layout.tsx`, `app/(app)/orgs/[orgId]/wiki/OrgWikiLayout.tsx`, `app/(app)/orgs/[orgId]/wiki/page.tsx`, `app/(app)/orgs/[orgId]/wiki/[wikiPageId]/page.tsx`
- Modify: the moved `WikiClient.tsx`, `WikiSidebar.tsx`, `wiki-sidebar/WikiTree.tsx`, `wiki-sidebar/WikiTreeItem.tsx`, `wiki-sidebar/useWikiSidebarCreatePage.ts`, `wiki-sidebar/useWikiPageDeletion.ts`, `wiki-sidebar/SecondBrainPanel.tsx`
- Modify: `projects/[projectId]/ProjectClientLayout.tsx`, `projects/[projectId]/project-layout/ProjectContentArea.tsx`, `projects/[projectId]/project-layout/ProjectSearchOverlay.tsx`

**Interfaces:**

- Consumes: `readActiveProject` / `writeActiveProject` (Task 3), the `kanban_wiki_page_updated` refresh contract (Task 4).
- Produces:
  - `OrgWikiLayout({ orgId, projects, enableSecondBrain }: { orgId: string; projects: ProjectDto[]; enableSecondBrain: boolean })`
  - `WikiClient({ orgId, sessionProjectId }: { orgId: string; sessionProjectId: string | null })`
  - `WikiSidebar({ orgId, projects, selectedProjectId, onSelectProject, enableSecondBrain, onRefresh }: { orgId: string; projects: ProjectDto[]; selectedProjectId: string | null; onSelectProject: (projectId: string) => void; enableSecondBrain: boolean; onRefresh: () => void })`
  - `SecondBrainPanel({ orgId, projectId, projects, onSelectProject, pages, onRefresh })` — `projectId: string` (non-null; the panel is not rendered without one)
  - `WikiTree({ pages, orgId, expandedIds, onToggle, onRefresh })` — no `projectId`
  - `WikiTreeItem({ page, orgId, ... })` — no `projectId`
  - `useWikiSidebarCreatePage({ orgId, onRefresh })`, `useWikiPageDeletion({ orgId, onDeleted })`

- [ ] **Step 1: Move the files**

```bash
cd /Users/stephane/projects/saas/kanban/apps/web/src/app/\(app\)/orgs/\[orgId\]
mkdir -p wiki
git mv "projects/[projectId]/WikiClient.tsx" wiki/WikiClient.tsx
git mv "projects/[projectId]/WikiSidebar.tsx" wiki/WikiSidebar.tsx
git mv "projects/[projectId]/wiki-sidebar" wiki/wiki-sidebar
```

The moved files import via the `@/` alias for shared code and relative paths only inside `wiki-sidebar/`, so no import path in the moved files needs editing. Verify with:
`grep -rn "\.\./\.\./" wiki/` — expect no hits pointing back into `projects/`.

- [ ] **Step 2: Write the wiki server layout**

Create `app/(app)/orgs/[orgId]/wiki/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { OrgWikiLayout } from "./OrgWikiLayout";

export default async function WikiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const [{ data: projects }, { data: me }] = await Promise.all([
    api.projects.list(token, orgId),
    api.auth.me(token),
  ]);

  return (
    <OrgWikiLayout
      orgId={orgId}
      projects={projects}
      enableSecondBrain={me.enableSecondBrain}
    >
      {children}
    </OrgWikiLayout>
  );
}
```

- [ ] **Step 3: Write the wiki client layout**

Create `app/(app)/orgs/[orgId]/wiki/OrgWikiLayout.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectDto } from "@kanban/shared";
import {
  readActiveProject,
  writeActiveProject,
} from "@/lib/activeProjectSession";
import { WikiClient } from "./WikiClient";
import { WikiSidebar } from "./WikiSidebar";

export function OrgWikiLayout({
  orgId,
  projects,
  enableSecondBrain,
  children,
}: {
  orgId: string;
  projects: ProjectDto[];
  enableSecondBrain: boolean;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const fromProjectId = searchParams.get("from");
  const activeProjects = projects.filter((project) => !project.archivedAt);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  // sessionStorage is unreadable during render, so the selection is resolved
  // after hydration: the `from` hint of a redirected old URL wins, then the
  // session, then the first non-archived project.
  useEffect(() => {
    const hinted =
      fromProjectId &&
      activeProjects.some((project) => project.id === fromProjectId)
        ? fromProjectId
        : null;
    if (hinted) {
      writeActiveProject(orgId, hinted);
      setSelectedProjectId(hinted);
      return;
    }
    const stored = readActiveProject(orgId);
    const valid =
      stored && activeProjects.some((project) => project.id === stored)
        ? stored
        : (activeProjects[0]?.id ?? null);
    setSelectedProjectId(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, fromProjectId, projects]);

  const selectProject = useCallback(
    (projectId: string) => {
      writeActiveProject(orgId, projectId);
      setSelectedProjectId(projectId);
    },
    [orgId],
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event("kanban_wiki_page_updated"));
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <WikiSidebar
        orgId={orgId}
        projects={activeProjects}
        selectedProjectId={selectedProjectId}
        onSelectProject={selectProject}
        enableSecondBrain={enableSecondBrain}
        onRefresh={refresh}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <WikiClient orgId={orgId} sessionProjectId={selectedProjectId} />
        <div className="hidden">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the two route leaves**

Create `app/(app)/orgs/[orgId]/wiki/page.tsx`:

```tsx
// The wiki UI is rendered by the layout, which survives navigation between
// /wiki and /wiki/<id>; remounting it per page would re-run the tab-restore
// effect against an already-changed URL. WikiClient reads wikiPageId itself.
export default function OrgWikiPage() {
  return null;
}
```

Create `app/(app)/orgs/[orgId]/wiki/[wikiPageId]/page.tsx` with the same body and the name `OrgWikiPageDetail`.

- [ ] **Step 5: Rewrite `WikiClient`**

In `wiki/WikiClient.tsx`:

- Props become `{ orgId, sessionProjectId }: { orgId: string; sessionProjectId: string | null }`. Delete the `projectId` and `tasks` props.
- Delete the `usePathname` import and the whole `isWikiRoute` block with its comment.
- In the URL-sync effect, delete the `if (!isWikiRoute) return;` line, drop `isWikiRoute` from the dependency array, and change the push target:

```tsx
router.push(`/orgs/${orgId}/wiki/${focusedPageId}`);
```

with the dependency array `[focusedPageId, urlWikiPageId, orgId, router]`, and replace the stale comment above it with:

```tsx
// Keep the URL in sync with the focused split's active page. Doing this in an
// effect (rather than pushing from click handlers) avoids stale reads of
// activePageId when a click bubbles up from inside the editor.
```

- Drop `projectId` from the `<WikiEditor ...>` call and pass no `tasks` for now (Task 10 adds the client-side task load). The call becomes:

```tsx
<WikiEditor
  key={split.activePageId}
  pageId={split.activePageId}
  orgId={orgId}
/>
```

- `sessionProjectId` is unused in this task; mark it consumed by prefixing the destructure with a `void sessionProjectId;` statement at the top of the body, and remove that line in Task 10 when the task fetch lands.

- [ ] **Step 6: Rewrite `WikiSidebar`**

In `wiki/WikiSidebar.tsx`, change the props and the two children:

```tsx
interface Props {
  orgId: string;
  projects: ProjectDto[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  enableSecondBrain: boolean;
  onRefresh: () => void;
}

export function WikiSidebar({
  orgId,
  projects,
  selectedProjectId,
  onSelectProject,
  enableSecondBrain,
  onRefresh,
}: Props) {
  const { pages, isLoading } = useWiki();
  useWikiSidebarCreatePage({ orgId, onRefresh });
```

Import `import type { ProjectDto } from "@kanban/shared";`. Render the Second Brain panel only when there is a project to attribute captures to:

```tsx
{
  enableSecondBrain && selectedProjectId && (
    <SecondBrainPanel
      orgId={orgId}
      projectId={selectedProjectId}
      projects={projects}
      onSelectProject={onSelectProject}
      pages={pages}
      onRefresh={onRefresh}
    />
  );
}
```

and drop `projectId` from `<WikiTree ... />`.

- [ ] **Step 7: Drop `projectId` from the tree**

In `wiki-sidebar/WikiTree.tsx`, remove `projectId` from `WikiTreeProps`, from the destructure, and from the `<WikiTreeItem ... />` call.

In `wiki-sidebar/WikiTreeItem.tsx`, remove `projectId` from the props interface (line 14), from the destructure (line 29), and from the `useWikiPageDeletion({ orgId, projectId, onDeleted })` call (line 46, which becomes `useWikiPageDeletion({ orgId, onDeleted })`), then change the navigation target (line 162):

```tsx
                `/orgs/${orgId}/wiki/${page.id}`,
```

- [ ] **Step 8: Update the two hooks**

`wiki-sidebar/useWikiSidebarCreatePage.ts` — drop `projectId` from `UseWikiSidebarCreatePageParams`, from the destructure, and from the effect dependency array; push:

```ts
router.push(`/orgs/${orgId}/wiki/${result.page.id}`);
```

`wiki-sidebar/useWikiPageDeletion.ts` — drop `projectId` from `UseWikiPageDeletionParams` and the destructure; push:

```ts
router.push(`/orgs/${orgId}/wiki`);
```

- [ ] **Step 9: Update `SecondBrainPanel` plumbing**

In `wiki-sidebar/SecondBrainPanel.tsx`:

- Extend the props:

```tsx
interface SecondBrainPanelProps {
  orgId: string;
  projectId: string;
  projects: ProjectDto[];
  onSelectProject: (projectId: string) => void;
  pages: WikiPageSummaryDto[];
  onRefresh: () => void;
}
```

with `import type { ProjectDto, WikiPageSummaryDto } from "@kanban/shared";`, and add `projects` / `onSelectProject` to the destructure (they are wired into the header in Task 9).

- Rewrite `openPage` — there is no board mounted behind the wiki any more, so the tab event is dead code:

```tsx
const openPage = (pageId: string) => {
  router.push(`/orgs/${orgId}/wiki/${pageId}`);
  window.dispatchEvent(
    new CustomEvent("kanban_open_wiki_page", { detail: pageId }),
  );
};
```

- Silence the not-yet-used props by passing them straight through in Task 9; for this task add `void projects; void onSelectProject;` at the top of the component body and delete those two lines in Task 9.

- [ ] **Step 10: Strip the wiki out of the project layout**

In `projects/[projectId]/ProjectClientLayout.tsx`:

- Delete the `WikiSidebar` import, the `activeTab` / `setActiveTab` state, `isWikiPath`, the `usePathname` import and call, the `useEffect` that syncs `activeTab`, and the `kanban_tab_changed` listener with its `handleTabChangeMessage` handler.
- Render the project sidebar unconditionally (no ternary) and drop the `activeTab === "board" &&` guard in front of `ArchivedProjectBanner` — the banner is only reachable from the board now.
- Drop `activeTab` from `<ProjectContentArea ... />` and `projectId` from `<ProjectSearchOverlay ... />`.
- In `onOpenTask`, delete the `setActiveTab("board")` line.

In `projects/[projectId]/project-layout/ProjectContentArea.tsx`: delete the `WikiClient` import, the `activeTab` prop from the signature and the type, and the wrapping `<div>`s' conditional classes — the body becomes:

```tsx
<main className="flex-1 overflow-hidden relative">
  <div className="h-full">
    <BoardClient
      initialTasks={initialTasks}
      orgMembers={orgMembers}
      projectId={projectId}
      orgId={orgId}
      currentUserId={currentUserId}
      maxOpenPanels={userPreferences.maxOpenPanels}
      enableNotifications={userPreferences.enableNotifications}
      maxNotifications={userPreferences.maxNotifications}
      notificationDuration={userPreferences.notificationDuration}
    />
  </div>
  <div className="hidden">{children}</div>
</main>
```

In `projects/[projectId]/project-layout/ProjectSearchOverlay.tsx`: remove `projectId` from the props and the destructure, and change the wiki result target to:

```tsx
onOpenWiki(`/orgs/${orgId}/wiki/${page.id}`);
```

- [ ] **Step 11: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS. The only remaining `projects/.../wiki` references are the two old route files (still `return null`) and `components/wiki-editor/MarkdownLink.tsx` — both handled in Tasks 6 and 8.

- [ ] **Step 12: Commit**

```bash
git add -A "apps/web/src/app/(app)/orgs/[orgId]"
git commit -m "feat(web): move wiki to org-level route"
```

---

## Task 6: Web — permanent redirects from the old wiki URLs

**Files:**

- Modify: `app/(app)/orgs/[orgId]/projects/[projectId]/wiki/page.tsx`
- Modify: `app/(app)/orgs/[orgId]/projects/[projectId]/wiki/[wikiPageId]/page.tsx`

**Interfaces:**

- Consumes: the `?from=<projectId>` hint read by `OrgWikiLayout` (Task 5).
- Produces: 308 redirects `/orgs/X/projects/Y/wiki` → `/orgs/X/wiki?from=Y` and `/orgs/X/projects/Y/wiki/Z` → `/orgs/X/wiki/Z?from=Y`.

- [ ] **Step 1: Redirect the wiki root**

Replace `projects/[projectId]/wiki/page.tsx`:

```tsx
import { permanentRedirect } from "next/navigation";

// The wiki moved to /orgs/[orgId]/wiki. Old links carry the project forward as
// `from` so the Board tab and the Second Brain panel keep their target.
export default async function ProjectWikiRedirect({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  permanentRedirect(`/orgs/${orgId}/wiki?from=${projectId}`);
}
```

- [ ] **Step 2: Redirect a specific page**

Replace `projects/[projectId]/wiki/[wikiPageId]/page.tsx`:

```tsx
import { permanentRedirect } from "next/navigation";

export default async function ProjectWikiPageRedirect({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; wikiPageId: string }>;
}) {
  const { orgId, projectId, wikiPageId } = await params;
  permanentRedirect(`/orgs/${orgId}/wiki/${wikiPageId}?from=${projectId}`);
}
```

- [ ] **Step 3: Verify by hand**

Run `pnpm dev`, open `/orgs/<orgId>/projects/<projectId>/wiki/<pageId>` in a fresh browser tab.
Expected: URL becomes `/orgs/<orgId>/wiki/<pageId>?from=<projectId>`, the page opens, and the Board tab returns to `<projectId>` (that part is only observable after Task 7 — for now just confirm the redirect and that the page renders).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/wiki"
git commit -m "feat(web): redirect old project wiki urls"
```

---

## Task 7: Web — session-backed Board↔Wiki switch

**Files:**

- Modify: `apps/web/src/components/HeaderTabs.tsx`
- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx` (write the session entry)

**Interfaces:**

- Consumes: `readActiveProject`, `writeActiveProject` (Task 3); the `/orgs/[orgId]/wiki` route (Task 5).
- Produces: `HeaderTabs()` — no props.

- [ ] **Step 1: Write the active project from the project layout**

In `ProjectClientLayout.tsx`, add the import:

```tsx
import { writeActiveProject } from "@/lib/activeProjectSession";
```

and, next to the existing hydration effect, add:

```tsx
// The wiki has no project in its URL; this is how the Board tab and the
// Second Brain panel know which project the tab was last working on.
useEffect(() => {
  writeActiveProject(orgId, projectId);
}, [orgId, projectId]);
```

- [ ] **Step 2: Rewrite `HeaderTabs`**

Replace `apps/web/src/components/HeaderTabs.tsx`:

```tsx
"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { readActiveProject } from "@/lib/activeProjectSession";

export function HeaderTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string | undefined;

  const isProjectRoute = pathname.includes("/projects/");
  const isWikiRoute = /^\/orgs\/[^/]+\/wiki(\/|$)/.test(pathname);
  const activeTab = pathname.includes("/wiki") ? "wiki" : "board";

  // Storage is read in the handler, never during render: sessionStorage does
  // not exist on the server and reading it in render desyncs hydration.
  const goToBoard = () => {
    if (!orgId) return;
    const projectId = readActiveProject(orgId);
    router.push(
      projectId ? `/orgs/${orgId}/projects/${projectId}` : `/orgs/${orgId}`,
    );
  };

  const goToWiki = () => {
    if (!orgId) return;
    router.push(`/orgs/${orgId}/wiki`);
  };

  if (!orgId || (!isProjectRoute && !isWikiRoute)) return null;

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={goToBoard}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeTab === "board"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Board
      </button>
      <button
        onClick={goToWiki}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeTab === "wiki"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Wiki
      </button>
    </div>
  );
}
```

`app/(app)/layout.tsx` already renders `<HeaderTabs />` with no props, so no call site changes.

- [ ] **Step 3: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 4: Verify by hand**

`pnpm dev`, then: open a project board → click Wiki → URL is `/orgs/X/wiki`, tab shows Wiki active → click Board → back to the same project. In a second browser tab open a different project and switch to the wiki: each tab's Board button returns to its own project. Open `/orgs/X/wiki` directly in a brand-new tab and click Board: lands on `/orgs/X` (the project list).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/HeaderTabs.tsx "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx"
git commit -m "feat(web): session-backed board/wiki switch"
```

---

## Task 8: Web — `MarkdownLink` resolves org-scoped and legacy links

**Files:**

- Modify: `apps/web/src/components/wiki-editor/MarkdownLink.tsx`
- Modify: `apps/web/src/components/wiki-editor/MarkdownPreview.tsx`, `WikiEditorSurface.tsx`, `types.ts`, `apps/web/src/components/WikiEditor.tsx` (drop the `projectId` prop chain)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `MarkdownLink({ href, children, currentOrgId, pages })` — no `projectId`
  - `MarkdownPreview({ content, pages, tasks, orgId })` — no `projectId`
  - `WikiEditorProps = { pageId: string; orgId: string; tasks?: TaskDto[] }`
  - Resolution rules: `wiki://<id>`, `/orgs/<org>/wiki/<id>`, and legacy `/orgs/<org>/projects/<proj>/wiki/<id>` all resolve to `/orgs/<currentOrgId>/wiki/<id>`; a link whose org differs from `currentOrgId` renders `DisabledLink`.

- [ ] **Step 1: Rewrite the wiki branch of `MarkdownLink`**

Replace the props block and the wiki-resolution block (lines 18-88 of the current file) with:

```tsx
export function MarkdownLink({
  href,
  children,
  currentOrgId,
  pages,
}: {
  href?: string;
  children: ReactNode;
  currentOrgId: string;
  pages: WikiPageSummaryDto[];
}) {
  const router = useRouter();
  if (!href) return <span>{children}</span>;

  // Three shapes reach here: the wiki:// scheme, the current org-scoped URL,
  // and the legacy project-scoped URL still stored in old page revisions.
  let wikiPageId: string | null = null;
  if (href.startsWith("wiki://")) {
    wikiPageId = href.replace("wiki://", "");
  } else {
    const legacyMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/wiki\/([^/?#]+)/,
    );
    const orgMatch = href.match(/\/orgs\/([^/]+)\/wiki\/([^/?#]+)/);
    if (legacyMatch) {
      const [, matchedOrgId, , pageId] = legacyMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      wikiPageId = pageId ?? null;
    } else if (orgMatch) {
      const [, matchedOrgId, pageId] = orgMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      wikiPageId = pageId ?? null;
    }
  }

  if (wikiPageId) {
    const exists = pages.some((p) => p.id === wikiPageId);
    const targetUrl = `/orgs/${currentOrgId}/wiki/${wikiPageId}`;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!exists) {
        alert(`Wiki page does not exist: ${wikiPageId}`);
        return;
      }

      router.push(targetUrl);
      window.dispatchEvent(
        new CustomEvent("kanban_open_wiki_page", { detail: wikiPageId }),
      );
    };

    return (
      <a
        href={targetUrl}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }
```

The `matchedProjectId` variable and the `page.projectId` lookup are gone: the target no longer depends on which project owns the page.

- [ ] **Step 2: Drop the prop chain**

- `MarkdownPreview.tsx`: remove `projectId` from the props type and destructure, and from the `<MarkdownLink ... />` call.
- `WikiEditorSurface.tsx`: remove `projectId` from the props type and destructure (lines 21/36) and from both `<MarkdownPreview ... />` calls (lines 76, 87).
- `wiki-editor/types.ts`: remove `projectId` from `WikiEditorProps`.
- `WikiEditor.tsx`: remove `projectId` from the destructure (line 37) and from `<WikiEditorSurface ... />` (line 172).

- [ ] **Step 3: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS. `grep -rn "projects/\${.*}/wiki" apps/web/src` should return nothing.

- [ ] **Step 4: Verify by hand**

`pnpm dev`, open a wiki page that contains a `[…](/orgs/X/projects/Y/wiki/Z)` link written before the migration (use a page's History view to find one, or type one into a scratch page). Clicking it lands on `/orgs/X/wiki/Z`. A link with a foreign org id renders greyed out and is not clickable.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wiki-editor apps/web/src/components/WikiEditor.tsx
git commit -m "feat(web): resolve wiki links to org scope"
```

---

## Task 9: Web — Second Brain project selector

**Files:**

- Modify: `app/(app)/orgs/[orgId]/wiki/wiki-sidebar/second-brain/SecondBrainHeader.tsx`
- Modify: `app/(app)/orgs/[orgId]/wiki/wiki-sidebar/SecondBrainPanel.tsx`

**Interfaces:**

- Consumes: `SecondBrainPanel`'s `projects` / `onSelectProject` props and the `selectedProjectId` state in `OrgWikiLayout` (Task 5); `writeActiveProject` is called by `OrgWikiLayout.selectProject`, so picking a project here also retargets the Board tab.
- Produces: `SecondBrainHeader({ collapsed, onToggle, inboxCount, reviewCount, onCapture, captureDisabled, bodyId, projects, projectId, onSelectProject })`.

- [ ] **Step 1: Add the selector to the header**

In `SecondBrainHeader.tsx`, extend the props:

```tsx
import type { ProjectDto } from "@kanban/shared";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  inboxCount: number;
  reviewCount: number;
  onCapture: () => void;
  captureDisabled: boolean;
  bodyId: string;
  projects: ProjectDto[];
  projectId: string;
  onSelectProject: (projectId: string) => void;
}
```

Add the two new names to the destructure, and wrap the existing markup so the selector sits under the title row:

```tsx
return (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      {/* …existing toggle button and capture button, unchanged… */}
    </div>
    {!collapsed && projects.length > 1 && (
      <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400">
        <span className="shrink-0">Project</span>
        <select
          value={projectId}
          onChange={(event) => onSelectProject(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 text-[11px] normal-case tracking-normal text-gray-700 outline-none focus:border-blue-400"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>
);
```

Keep `CountBadge`, `ChevronIcon`, and `PlusIcon` as they are.

- [ ] **Step 2: Feed the selector from the panel**

In `SecondBrainPanel.tsx`, delete the `void projects; void onSelectProject;` line added in Task 5 and pass them through:

```tsx
<SecondBrainHeader
  collapsed={collapsed}
  onToggle={toggleCollapsed}
  inboxCount={inboxCount}
  reviewCount={reviewCount}
  onCapture={() => {
    storeCollapsed(false);
    setIsCaptureOpen((open) => !open);
  }}
  captureDisabled={isPending}
  bodyId={SECOND_BRAIN_BODY_ID}
  projects={projects}
  projectId={projectId}
  onSelectProject={onSelectProject}
/>
```

`useSecondBrainData(pages, projectId)` keeps its signature — it now receives the selected project instead of the route's project, so the inbox and review lists follow the selector.

- [ ] **Step 3: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 4: Verify by hand**

In an org with two projects and Second Brain enabled: open the wiki, switch the selector to the second project — the Inbox/Review counts change to that project's captures, and clicking Board afterwards goes to the second project. Create a capture and confirm it lands in the selected project (the created task from "Triage" appears on that project's board). In an org with no project, the Second Brain panel is not rendered.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/wiki/wiki-sidebar"
git commit -m "feat(web): project selector in second brain"
```

---

## Task 10: Web — task mentions in the wiki editor

**Files:**

- Modify: `app/(app)/orgs/[orgId]/wiki/WikiClient.tsx`

**Interfaces:**

- Consumes: `sessionProjectId` from `OrgWikiLayout` (Task 5); `getProjectViewDataAction(orgId, projectId)` from `@/actions/projects`, returning `{ tasks, members, me, currentUserId }`.
- Produces: `WikiEditor` receives `tasks?: TaskDto[]` — `undefined` when there is no session project.

- [ ] **Step 1: Load the tasks client-side**

In `WikiClient.tsx`, remove the `void sessionProjectId;` placeholder and add:

```tsx
// The wiki layout is a server component and cannot read sessionStorage, so
// the mention list is fetched after hydration, for whichever project the tab
// is currently attached to. No project → no mentions.
const [tasks, setTasks] = useState<TaskDto[] | undefined>(undefined);
useEffect(() => {
  if (!sessionProjectId) {
    setTasks(undefined);
    return;
  }
  let cancelled = false;
  void getProjectViewDataAction(orgId, sessionProjectId)
    .then((data) => {
      if (!cancelled) setTasks(data.tasks);
    })
    .catch((e: unknown) => {
      console.error("Failed to load tasks for wiki mentions", e);
    });
  return () => {
    cancelled = true;
  };
}, [orgId, sessionProjectId]);
```

with `import { useEffect, useRef, useState } from "react";` and `import { getProjectViewDataAction } from "@/actions/projects";`.

- [ ] **Step 2: Pass them to the editor**

```tsx
<WikiEditor
  key={split.activePageId}
  pageId={split.activePageId}
  orgId={orgId}
  tasks={tasks}
/>
```

- [ ] **Step 3: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 4: Verify by hand**

In the wiki editor of an org with a session project, the task-mention picker (toolbar → task link) lists that project's tasks. Switch the Second Brain selector to another project: the picker lists the other project's tasks. On `/orgs/X/wiki` opened in a fresh tab of an org with no project, the picker is empty and nothing throws.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/wiki/WikiClient.tsx"
git commit -m "feat(web): load wiki mentions from session project"
```

---

## Task 11: Web — task links from the wiki navigate to the board

**Files:**

- Modify: `apps/web/src/components/wiki-editor/MarkdownLink.tsx` (the task branch)
- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `/orgs/<orgId>/projects/<projectId>?taskId=<taskId>` opens that task's panel on arrival. The `kanban_open_task` window event keeps working for same-page opens (the board's search overlay uses it).

- [ ] **Step 1: Make the task link navigate**

In the task branch of `MarkdownLink.tsx`, replace the click handler and `realHref`:

```tsx
  if (taskId) {
    // The board is a different route now, so opening a task means navigating:
    // the window event alone would be dispatched into a page with no board.
    const realHref = taskProjectId
      ? `/orgs/${currentOrgId}/projects/${taskProjectId}?taskId=${taskId}`
      : href;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (!taskProjectId) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(realHref);
    };
```

A bare `task://<id>` link carries no project, so it keeps its default anchor behaviour rather than navigating nowhere.

- [ ] **Step 2: Open the task named by the query param**

In `BoardClient.tsx`, next to the existing `kanban_open_task` effect, add:

```tsx
const searchParams = useSearchParams();
const requestedTaskId = searchParams.get("taskId");
useEffect(() => {
  if (!requestedTaskId || !isMounted) return;
  panels.handleOpenTask(requestedTaskId);
  // Opening once per arrival: handleOpenTask is recreated on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [requestedTaskId, isMounted]);
```

with `import { useSearchParams } from "next/navigation";`.

- [ ] **Step 3: Type-check and build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 4: Verify by hand**

From a wiki page containing a task link (`[…](/orgs/X/projects/Y/tasks/Z)` or one inserted with the editor's task-link tool), click it: the board for project Y opens with task Z's panel open. `Cmd`-click still opens a new browser tab.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wiki-editor/MarkdownLink.tsx "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx"
git commit -m "feat(web): navigate to board from wiki task links"
```

---

## Task 12: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: API tests**

Run: `cd apps/api && pnpm test`
Expected: PASS, including `src/tests/db/wiki-link-migration.test.ts` and `src/tests/features/wiki.service.test.ts`.

- [ ] **Step 2: Lint and build the monorepo**

Run: `pnpm lint && pnpm build`
Expected: PASS with no warnings introduced by this work.

- [ ] **Step 3: Grep for leftovers**

Run: `grep -rn "projects/[^\"'\`]_\/wiki" apps/web/src apps/api/src --include=_.ts --include=\*.tsx`Expected: hits only in`projects/[projectId]/wiki/page.tsx`and`projects/[projectId]/wiki/[wikiPageId]/page.tsx`(the redirects) and in`MarkdownLink.tsx` (the legacy matcher).

- [ ] **Step 4: Manual pass against a real database**

Run `pnpm dev` against the development database (the migration runs at API start-up) and walk:

1. Board → Wiki → Board round trip, ending on the same project.
2. `/orgs/X/wiki` opened in a fresh tab with no session project: wiki loads, Board goes to `/orgs/X`.
3. An old `/orgs/X/projects/Y/wiki/Z` bookmark: redirects, opens page Z, Board returns to project Y.
4. Second Brain selector switches projects; captures land in the selected project.
5. `Cmd+K` on the board still returns wiki pages, and clicking one opens `/orgs/X/wiki/<id>`.
6. The Organization Index page's Knowledge Base links are org-scoped and work.
7. A pre-migration revision opened from a page's History still resolves its links.
8. Creating, renaming, dragging, and deleting pages in the sidebar all still work and stay on `/orgs/X/wiki`.

- [ ] **Step 5: Commit anything the pass fixed**

```bash
git add -A
git commit -m "fix: org-scoped wiki verification follow-ups"
```

(Skip this step if nothing changed.)
