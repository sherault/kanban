# MCP tool: `get_task_history`

Date: 2026-07-27

## Problem

Task change history is already recorded (`task_history` table) and rendered in the web UI, but agents working through MCP cannot read it. Two concrete needs:

- **Crash recovery** — an agent resuming work on a task needs to know what changed last and who changed it, rather than re-deriving state.
- **Retrospective** — reconstructing how a task moved through columns, who took it, and when.

## Scope

One new MCP tool, plus a deterministic ordering fix in the service that backs it. No schema change, no new HTTP route, no web change.

## Existing pieces

- `apps/api/src/db/schema/board.ts` — `taskHistory` table: `id`, `taskId`, `userId`, `field`, `oldValue`, `newValue`, `changedAt`, `batchId`.
- `apps/api/src/features/task/task-service/update-delete-history.ts` — `TaskUpdateHistoryOperations.getTaskHistory(taskId): TaskHistoryDto[]`, resolving each row's actor to `{ id, displayName }`.
- `packages/shared/src/dtos/board.ts` — `TaskHistoryDto`.
- `apps/api/src/features/mcp/mcp-server/task-list-tools.ts` — `get_task`, `list_tasks`. New tool goes here.

## Tool contract

Name: `get_task_history`

Description: retrieve the change history of a task, newest first — who changed which field, from what to what, and when.

Input:

| Param    | Type   | Required | Default | Notes                                        |
| -------- | ------ | -------- | ------- | -------------------------------------------- |
| `taskId` | string | yes      | —       | Task ID                                      |
| `field`  | string | no       | —       | Exact-match filter on the changed field name |
| `page`   | int    | no       | 1       | ≥ 1                                          |
| `limit`  | int    | no       | 50      | 1–100                                        |

Output (JSON via `jsonText`):

```json
{
  "taskId": "...",
  "entries": [
    {
      "field": "column",
      "oldValue": "todo",
      "newValue": "doing",
      "actor": { "id": "...", "displayName": "..." },
      "changedAt": "2026-07-27 18:04:11",
      "batchId": "..."
    }
  ],
  "pagination": { "total": 137, "page": 1, "limit": 50, "totalPages": 3 }
}
```

`total` counts rows after the `field` filter, before pagination. Page 1 is the most recent changes; deeper pages walk backwards in time.

Unknown task: `textResult("Task not found", true)`, matching `get_task`. Existence is checked with `taskSvc.getTask(taskId)` so that a task with an empty history returns an empty `entries` array rather than an error.

## Ordering

`getTaskHistory` has no `ORDER BY` today, so row order is whatever SQLite returns. Add `orderBy(desc(taskHistory.changedAt), desc(taskHistory.id))`. `changedAt` has second granularity, so the `id` tiebreaker keeps a single batch's entries stable across calls — a requirement for correct pagination.

This changes the order seen by the existing HTTP route (`GET` history in `task-routes/crud.ts`, consumed by the web task-detail sidebar) from insertion-ish to explicitly newest-first. That is the order the sidebar wants anyway; verify the sidebar does not re-sort or assume ascending order.

## Value truncation

Description edits store the full text in `oldValue`/`newValue`. A history page over such a task could flood an agent's context. The MCP tool truncates each of `oldValue`/`newValue` to 500 characters, appending `…[truncated]`. Truncation lives in the MCP tool only — the service and the web UI keep full values.

## Filtering and pagination placement

The service returns the full sorted list; the MCP tool applies the `field` filter and slices the page. This mirrors `list_tasks`, which filters in the tool layer over `taskSvc.listTasks`. Consistency beats the marginal query efficiency at current data volumes.

## Testing

TDD, Vitest, in `apps/api/src/tests/features/`:

Service (`createTestDb`, real inserts):

- history is returned newest-first
- entries sharing one `changedAt` are ordered deterministically by `id`

MCP tool (existing mock-service harness pattern):

- default call returns entries plus a correct `pagination` block
- `page`/`limit` slice correctly; `total` reflects the unpaginated count
- `field` filter narrows both `entries` and `total`
- unknown `taskId` returns the not-found error result
- task with no history returns `entries: []` and `total: 0`
- an `oldValue`/`newValue` longer than 500 chars is truncated with the suffix

## Out of scope

- Grouping entries by `batchId` into changelog-style records
- Date-range filters
- Changes to the existing history HTTP route (`apps/api/src/features/task/task-routes/crud.ts`, consumed by the web `getTaskHistoryAction`); it keeps returning the full untruncated, unpaginated list — only its order changes
