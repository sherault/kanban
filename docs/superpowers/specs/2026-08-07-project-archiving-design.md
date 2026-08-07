# Project Archiving — Design

Date: 2026-08-07

## Goal

Let an organization archive a project as a reversible alternative to deletion. Archived
projects disappear from the main project lists but stay reachable through collapsible
"Archived" sections, and their wiki knowledge base page carries a visible archive notice.

## Semantics

- Archiving is **classification only**. An archived project stays fully editable: board,
  tasks, wiki, and settings behave exactly as before. No read-only guards are added.
- Archiving is reversible via a "Restore" action in the same danger zone.
- Deleting an archived project is still allowed and unchanged.

## Data model

`apps/api/src/db/schema/project.ts` gains:

```ts
archivedAt: text("archived_at"),
```

Nullable, mirroring `tasks.archivedAt` in `board.ts`. New Drizzle migration committed under
`apps/api/drizzle/migrations/`.

`ProjectDto` in `packages/shared` gains `archivedAt: string | null`.

## API

`ProjectService` (`apps/api/src/features/project/project.service.ts`):

- `toDto` maps `archivedAt: row.archivedAt ?? null`.
- `listProjects(orgId)` keeps returning **all** projects, active and archived. The split is
  done in the web layer. No `includeArchived` parameter — project counts per org are small
  and a second query path would duplicate logic for no gain.
- `archiveProject(orgId, projectId, userId?)`
  - `notFound` if the project does not exist or belongs to another org.
  - `unprocessable("Project is already archived")` if `archivedAt` is set.
  - Sets `archivedAt` to the current ISO timestamp.
  - Broadcasts `project.updated` on `org:${orgId}` with the new DTO.
  - Calls `syncOrganizationIndexForProjectArchived`.
- `restoreProject(orgId, projectId, userId?)`
  - `notFound` under the same conditions.
  - `unprocessable("Project is not archived")` if `archivedAt` is null.
  - Sets `archivedAt` to null, broadcasts `project.updated`, calls
    `syncOrganizationIndexForProjectRestored`.

Routes in `project.routes.ts`, modeled on `task-routes/archive.ts`:

- `POST /orgs/:orgId/projects/:projectId/archive`
- `POST /orgs/:orgId/projects/:projectId/restore`

Both return the updated `ProjectDto`.

## Wiki integration

All changes live in `apps/api/src/features/wiki/wiki-service/project-index.ts`.

### Organization Index page

- `listActiveProjects` gains `isNull(projects.archivedAt)` to its where clause.
- New `listArchivedProjects(ctx, orgId, excludeProjectId?)` returning `id`, `name`,
  `archivedAt`, sorted by name.
- `buildAutomatedIndexBlock` renders three sections inside the existing
  `kanban:auto-project-index` markers: `### Active`, `### Archived`, `### Deleted`.
- Archived entries keep both links:

  ```
  - **Sprint**: archived on 2026-08-07 | [Board](/orgs/<orgId>/projects/<id>) | [Knowledge Base](/orgs/<orgId>/projects/<id>/wiki/<pageId>)
  ```

- The Archived section is **derived from the database** on every sync, unlike the Deleted
  section which is re-parsed from the previous markdown (deleted rows no longer exist).
  This makes restore free: the entry moves back to Active on the next sync.
- The Archived section is omitted entirely when there are no archived projects.
- `findOrCreateProjectKnowledgeBase` is still used for archived projects so their KB page
  link resolves.

### KB page notice

`syncOrganizationIndexForProjectArchived` inserts a block at the top of the project's KB
page content, between dedicated markers:

```html
<!-- kanban:project-archived:start -->
<details>
  <summary>⚠️ Archived project</summary>

  This project was archived on 2026-08-07.
</details>
<!-- kanban:project-archived:end -->
```

The date is `YYYY-MM-DD`, using the existing `formatDeletedAt`-style helper.

`syncOrganizationIndexForProjectRestored` strips everything between the markers inclusive
and trims the leftover whitespace.

Both operations are idempotent: archiving a page that already carries the block replaces it
rather than stacking, and restoring a page without the block is a no-op. Content updates go
through the existing `updateTrackedWikiPage`, so history rows and `wiki.page_updated`
broadcasts come for free.

## MCP tools

New tools in the project MCP tool module, mirroring `archive_task` / `restore_task` in
`task-lifecycle-tools.ts`:

- `archive_project` — input `{ projectId }`, delegates to `ProjectService.archiveProject`
  with source `"mcp"`.
- `restore_project` — input `{ projectId }`, delegates to `restoreProject`.

`list_projects` output includes `archived: true` for archived projects, matching how
`get_task` flags archived tasks.

## Web

### Project settings danger zone

`apps/web/src/components/project-settings/ProjectDangerTab.tsx` gains a card above the
existing red delete card.

- When `project.archivedAt === null`: amber card, heading "Archive Project", copy explaining
  the project is hidden from the main lists but stays editable and can be restored. Single
  "Archive Project" button opening a confirm dialog — no type-to-confirm, since the action is
  reversible.
- When `project.archivedAt` is set: the same card switches to "Restore Project", shows the
  archive date, and offers a "Restore Project" button (no confirmation needed).
- The delete card is unchanged and available in both states.

`ProjectSettingsModal` wires the two new mutations, reusing the existing pending/error state
pattern, and refreshes the project on success.

### Organization project list

`apps/web/src/app/(app)/orgs/[orgId]/ProjectListClient.tsx`:

- The main grid renders active projects only. The empty state triggers when there are no
  active projects.
- Below the grid, a collapsible section using a native `<details>` element: summary reads
  `Archived projects (N)`, collapsed by default.
- Archived cards reuse the active card markup with muted styling (reduced opacity, gray
  hover instead of blue) and an "Archived" badge.
- The whole section is not rendered when there are no archived projects.

### Board sidebar

`apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectSidebar.tsx`:

- The project list renders active projects only.
- Directly above the "New project" link, a collapsible "Archived (N)" section. Expansion is
  plain `useState(false)` local state — no persistence, unlike the wiki tree expansion.
- Not rendered when there are no archived projects.
- If the currently viewed project is archived it still appears inside the archived section
  and is highlighted as active there.

### Board header badge

The board header shows a discreet "Archived" badge when the current project has
`archivedAt` set, so an archived project cannot be worked in unknowingly.

## Testing

Vitest, `apps/api`, using `createTestDb()`:

- `archiveProject` sets `archivedAt`; `restoreProject` clears it.
- 404 for unknown project and for a project in another org, on both operations.
- 422 when archiving an already-archived project and when restoring an active one.
- `listProjects` returns archived projects with `archivedAt` populated.
- Organization Index sync: an archived project leaves `### Active` and appears under
  `### Archived` with board and KB links; restore moves it back and drops the section.
- KB page: archive inserts the `<details>` block once (double archive does not stack),
  restore removes it fully, restore on a clean page is a no-op.
- Archive followed by delete still produces a correct `### Deleted` entry.
- MCP `archive_project` / `restore_project` end-to-end through the tool handlers.
