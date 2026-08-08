# Org-Scoped Wiki — Design

Date: 2026-08-08

## Goal

The wiki is already an organization-level resource in the database and the API, but the
web app routes it under a project: `/orgs/[orgId]/projects/[projectId]/wiki/[wikiPageId]`.
Move the wiki to `/orgs/[orgId]/wiki/[wikiPageId]` so the URL matches the data model,
while keeping the wiki reachable from a project and keeping the Board↔Wiki header switch.

## Current State

What is already org-scoped and needs no change:

- `wiki_pages.organization_id` is `NOT NULL`; `wiki_pages.project_id` is nullable.
- API endpoints: `POST/GET /organizations/:orgId/wiki/pages`, `GET/PATCH/DELETE /wiki/pages/:id`.
- `lib/wikiTabsStorage.ts` and `lib/wikiExpandedStorage.ts` are keyed by `orgId`.
- Deleted-project entries in the org index use `wiki://<id>`, not URLs
  (`project-index.ts:368`).

What is project-scoped and must change:

- The route segment itself, plus the wiki URL construction spread over 9 files:
  `WikiClient`, `useWikiSidebarCreatePage`, `SecondBrainPanel`, `useWikiPageDeletion`,
  `WikiTreeItem`, `ProjectSearchOverlay`, `HeaderTabs`, `actions/wiki.ts`, `MarkdownLink`.
- `ProjectClientLayout` mounts board **and** wiki simultaneously, toggling with CSS.
  `wiki/page.tsx` and `wiki/[wikiPageId]/page.tsx` both `return null`; the real render
  happens in `ProjectContentArea`.
- `project-index.ts:228,244` writes `[Knowledge Base](/orgs/X/projects/Y/wiki/Z)` links
  into the org index.
- `MarkdownLink.tsx:41` parses the project-scoped URL shape out of page content.
- Second Brain is genuinely project-scoped: `useSecondBrainData.ts:17` filters captures by
  `projectId`, and capture/triage/freshness actions create tasks in a project.

## Decisions

| Question                          | Decision                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Wiki layout                       | Dedicated org-level layout, full org tree, no project chrome                  |
| Board tab with no session project | Go to `/orgs/[orgId]` (project list)                                          |
| Session storage                   | `sessionStorage`, per browser tab                                             |
| Old URLs                          | Permanent redirect, kept indefinitely                                         |
| Existing content                  | DB migration rewriting links, plus retro-compatible parsing in `MarkdownLink` |
| Second Brain                      | Explicit project selector in the panel, seeded from the session project       |
| Task mentions                     | Tasks of the session project; none when there is no session project           |
| Board `Cmd+K`                     | Keeps wiki results — `WikiProvider` moves up to the org layout                |

Rejected alternatives: keeping the wiki components physically under `projects/[projectId]/`
(leaves the structural inconsistency in place), and a Next middleware URL rewrite (the wiki
would still load board, tasks, and members of a project on every render).

## Architecture

### Routes

```
app/(app)/orgs/[orgId]/
  layout.tsx                  # hosts WikiProvider + wiki page fetch (was a pass-through)
  wiki/
    layout.tsx                # server: token, projects, user prefs → OrgWikiLayout
    OrgWikiLayout.tsx         # client: WikiSidebar + WikiClient
    page.tsx                  # no page selected
    [wikiPageId]/page.tsx     # page selected
    WikiClient.tsx            # moved from projects/[projectId]/
    WikiSidebar.tsx           # moved
    wiki-sidebar/**           # moved (13 files + second-brain/6)
```

`WikiProvider` and the `listWikiPagesAction` fetch move from `ProjectClientLayout` to
`orgs/[orgId]/layout.tsx` so both the board's `Cmd+K` search and the wiki tree read the
same page list. The `kanban_wiki_page_updated` listener moves with it.

`orgs/[orgId]/layout.tsx` stays a server component and delegates to a new thin client
component (`OrgWikiProviderShell`) that owns `WikiProvider`, the client-side `fetchPages`
callback, and the refresh listener — the same pattern `ProjectClientLayout` uses today, so
the fetch stays client-side and no page-list data is added to the server render of every
org route.

Unlike the project route, the new `page.tsx` files render normally instead of returning
`null`: the wiki is no longer mounted alongside the board, so there is no CSS-toggle trick
to work around. The layout renders the shell; the page supplies `wikiPageId`.

### Redirects

`projects/[projectId]/wiki/page.tsx` and `projects/[projectId]/wiki/[wikiPageId]/page.tsx`
become server components that `redirect()` to `/orgs/[orgId]/wiki[/pageId]`. They set a
short-lived cookie carrying `projectId` so the client can seed the session project from an
old link, preserving the Board target.

### ProjectClientLayout cleanup

Removed: `activeTab` state, `isWikiPath`, the `kanban_tab_changed` listener, the
`<WikiSidebar>` branch, `fetchPages`, `WikiProvider`, and the `kanban_wiki_page_updated`
listener. `ProjectContentArea` loses its `activeTab` prop and `WikiClient`, rendering only
`BoardClient`.

`WikiClient` loses the workarounds that existed only because it was mounted under the
board: the `isWikiRoute` pathname guard, and the interaction between the restore effect and
the URL-sync effect that it forced.

### Session-backed Board↔Wiki switch

New `lib/activeProjectSession.ts`, mirroring `wikiTabsStorage.ts` but on `sessionStorage`
with key `kanban_active_project_<orgId>`:

```ts
readActiveProject(orgId): string | null
writeActiveProject(orgId, projectId): void
```

`ProjectClientLayout` writes it on mount and whenever `projectId` changes.

`HeaderTabs.tsx` changes:

- Visibility: shown on `/orgs/x/projects/*` **and** `/orgs/x/wiki*` (was: only paths
  containing `/projects/`).
- Active tab: `pathname.includes("/wiki")`, unchanged, correct for both shapes.
- Wiki click → `/orgs/${orgId}/wiki`. `WikiClient` then restores tabs from
  `readWikiTabs(orgId)` and pushes the focused page's URL, exactly as today.
- Board click → `readActiveProject(orgId)` if set, else `/orgs/${orgId}`.

Storage is read inside the click handler, not during render, so there is no
server/client hydration mismatch.

`sessionStorage` is per tab: two browser tabs on two different projects each keep their own
Board target.

### Second Brain

`SecondBrainHeader.tsx` gains a `<select>` of the org's non-archived projects, initialised
from `readActiveProject(orgId)` and falling back to the first project. Selecting a project
writes it back to the session, so the Board tab and the Second Brain panel always agree on
which project is active. If the org has no project, the panel is hidden.

`useSecondBrainData(pages, projectId)` keeps its signature, fed by the selected project
instead of the route. `createSecondBrainCaptureAction`,
`createTriageTaskForWikiPageAction`, `createFreshnessTaskForWikiPageAction`, and
`markWikiPageTriagedAction` keep their `projectId` parameter (they create tasks in a
project), but `actions/wiki.ts:54` `projectWikiPath(orgId, projectId)` becomes
`orgWikiPath(orgId)` returning `/orgs/${orgId}/wiki`.

### Task mentions

The wiki layout is a server component and cannot read `sessionStorage`, so `WikiClient`
loads tasks client-side after hydration via `getProjectViewDataAction(orgId, sessionProjectId)`.
With no session project, `tasks` stays `undefined` — `WikiEditor` already accepts
`tasks?: TaskDto[]`.

### projectId prop removal

In most wiki components `projectId` exists only to build a URL, so it is **removed**
rather than made nullable: `WikiTree`, `WikiTreeItem`, `MarkdownLink`, `MarkdownPreview`,
`WikiEditorSurface`, `wiki-editor/types.ts`, `useWikiSidebarCreatePage`,
`useWikiPageDeletion`. Only `SecondBrainPanel` and the task-mention path keep it, sourced
from the session.

`MarkdownLink.tsx` drops `matchedProjectId` entirely. Both `wiki://<id>` and the legacy
`/orgs/X/projects/Y/wiki/Z` shape resolve to `/orgs/${currentOrgId}/wiki/${wikiPageId}`.
The cross-org guard (`matchedOrgId !== currentOrgId` → `DisabledLink`) is kept. This
retro-compatible parsing is what keeps old wiki revisions readable.

## Data Migration

`drizzle/migrations/0015_org_scoped_wiki_links.sql`, hand-written like `0012` and `0013`,
with a matching entry appended to `meta/_journal.json`.

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

The recursive CTE folds one `replace` pair per project of the page's own organization, so a
single page containing links to several projects is fully rewritten. The nested `replace`
handles the wiki root link (`.../wiki` with no page id) after the inner call has already
consumed the `.../wiki/<id>` form, which makes the outer call safe.

Verified against SQLite 3.51 on: multiple project links in one page, a bare `/wiki` root
link, board links `/orgs/X/projects/Y` (preserved), and cross-org links (left untouched —
`MarkdownLink` disables them anyway). The statement is idempotent.

`wiki_page_history` is **not** migrated: it is a revision journal, and rewriting it would
falsify history. Old revisions stay readable through `MarkdownLink`'s legacy parsing.

`project-index.ts:228,244` change to `[Knowledge Base](/orgs/${orgId}/wiki/${pageId})`;
the `[Board]` link stays `/orgs/${orgId}/projects/${project.id}`. The auto-generated block
is rebuilt on every `listPages` call (`page-reads.ts:15` → `ensureOrganizationIndexPage` →
`syncOrganizationIndex`), so the org index would repair itself even without the migration.
The migration still covers it, harmlessly.

## Testing

`apps/api` is the only tested app; `apps/web` has no test setup.

| Test                                                                                                 | File                                                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Org index emits `[Knowledge Base](/orgs/X/wiki/Z)` and `[Board](/orgs/X/projects/Y)`                 | `tests/features/wiki.service.test.ts` (update existing assertions) |
| Migration rewrites multiple links in one page, the bare `/wiki` root link, and preserves board links | `tests/db/wiki-link-migration.test.ts` (new)                       |
| Deleted-project entries (`wiki://`) survive the migration                                            | `tests/db/wiki-link-migration.test.ts`                             |
| Regenerating the index after migration produces no diff                                              | `tests/features/wiki.service.test.ts`                              |

`createTestDb()` applies migrations to an empty database, so there is nothing to migrate at
that point. The migration test must insert rows and then replay the migration explicitly by
reading the `.sql` file and running it — the only way to exercise a data migration here.

Manual verification (web): Board↔Wiki switch both directions; wiki opened directly with no
session project; an old project-scoped URL redirecting correctly; the Second Brain project
selector; `Cmd+K` on the board still returning wiki pages.

## Out of Scope

- No database schema change. `wiki_pages.project_id` keeps its current meaning (which
  project a page belongs to, used for KB pages and Second Brain filtering).
- No change to the API surface or the MCP wiki tools.
- No redesign of the wiki UI beyond removing project chrome.
