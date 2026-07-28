# Task history source (MCP vs Web) — design

Date: 2026-07-28

## Problem

Every action on a task writes a `task_history` row. Nothing distinguishes an action
performed through the MCP server from one performed through the web front. Users
reading a task's history cannot tell whether an agent or a human made a change.

## Goal

Record the origin of each history entry and display it in the task history feed,
without breaking existing rows.

## Backward compatibility rule

- Rows written before this change have no source: the column is `NULL`, the DTO
  field is `null`, and the UI renders nothing extra for them.
- Rows written after this change always carry a source (`"mcp"` or `"web"`).

There is no backfill.

## Data model

`apps/api/src/db/schema/board.ts`, table `task_history`:

```ts
source: text("source"), // "mcp" | "web" | null
```

Nullable `TEXT`, no default, no constraint. A Drizzle migration adds the column
(`ALTER TABLE task_history ADD COLUMN source text;`) — additive and safe on
existing databases.

## Shared DTO

`packages/shared/src/dtos/board.ts`:

```ts
export type TaskHistorySource = "mcp" | "web";

export interface TaskHistoryDto {
  // ...existing fields
  source: TaskHistorySource | null;
}
```

## API

### Source resolution

The API already threads an `isMcp?: boolean` flag through `TaskService` for
WebSocket broadcasts. The same flag decides the history source. A single helper
lives on `TaskServiceBase` (`apps/api/src/features/task/task-service/base.ts`):

```ts
protected historySource(isMcp?: boolean): TaskHistorySource {
  return isMcp ? "mcp" : "web";
}
```

Any non-MCP write is `"web"`. REST routes pass nothing, so `isMcp` is `undefined`
and resolves to `"web"`. MCP tools already pass `true`.

### Write sites

Every `insert(taskHistory)` call sets `source`:

| File                                    | Sites                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| `task-service/update-delete-history.ts` | `updateTask` field entries, `appendNote`, `replaceTags` |
| `task-service/move.ts`                  | column move entry                                       |
| `task-service/archive.ts`               | archive entry, restore entry                            |
| `task-service/participants.ts`          | `insertParticipantHistory` (watchers, advisors)         |
| `task-service/relations.ts`             | `addTag`, `removeTag`                                   |

`addLink` / `removeLink` write no history row today, so they stay untouched.

### Plumbing to extend

`participants.ts` and `relations.ts` currently take no `isMcp`. Add an optional
trailing `isMcp?: boolean` parameter to:

- `addWatcher`, `removeWatcher`, `addAdvisor`, `removeAdvisor`,
  `insertParticipantHistory`, `broadcastParticipantUpdate`
- `addTag`, `removeTag`

and to the matching façade methods on `TaskService` (`task.service.ts`).
`replaceTags` in `update-delete-history.ts` also takes the source through from
`updateTask`. Callers that omit the argument keep today's behaviour and produce
`"web"`.

### Read

`getTaskHistory` maps `source: row.source` straight through. No fallback, no
coercion: `NULL` stays `null`.

## Web

`apps/web/.../task-detail-sidebar/HistoryFeed.tsx` renders a small badge after the
actor name when `entry.source` is non-null:

```
Alice changed title from A to B  [via MCP] · Jul 28, 14:32
Bob changed tags from x to y     [via Web] · Jul 28, 14:30
Carol changed doerId to Z                  · Jul 12, 09:01   (legacy row, no badge)
```

Label: `via MCP` for `"mcp"`, `via Web` for `"web"`. Styled like the existing
muted metadata text (small, gray), not a coloured pill.

## Testing

Vitest integration tests in `apps/api/src/tests/features/task-history.test.ts`
(and neighbouring task tests) using `createTestDb()`:

1. `updateTask` without `isMcp` → history rows have `source === "web"`.
2. `updateTask` with `isMcp: true` → `source === "mcp"`.
3. `appendNote`, `moveTask`, archive/restore, tag change and watcher add each
   record the expected source under both flags.
4. A history row inserted directly with `source` omitted → `getTaskHistory`
   returns `source: null` (legacy-row guarantee).

The web app has no test suite; the badge is verified by reading the component.

## Out of scope

- Backfilling existing rows.
- Filtering or sorting history by source.
- Source tracking on wiki page history.
- Distinguishing third-party REST clients from the web front (a future
  `X-Client-Source` header could refine `"web"` into `"web"` vs `"api"`; the
  nullable column and string type leave room for it).
