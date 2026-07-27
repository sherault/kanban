# get_board MCP tool — design

Date: 2026-07-27

## Problem

The board is exposed only as an MCP resource, `kanban://projects/{projectId}/board`.
Claude Code consumes a resource only through an explicit `@`-mention, and a sub-agent
cannot `@`-mention anything. Sub-agents therefore fall back to several paginated
`list_tasks` calls to reconstruct the board — four or more round trips to obtain what
one render already produces.

The resource render is also thin: it shows only the task id, title and doer. Tags,
colour and deadline — all present in `TaskDto` — are dropped, so an agent that needs
them must call `list_tasks` or `get_task` anyway.

## Goal

Expose the same board render as a **tool**, callable by any agent including sub-agents,
enriched with tags, background colour and due date. One call at session start replaces
four paginated `list_tasks` calls.

## Non-goals

- Changing `list_tasks`, `get_task` or `get_task_history`.
- Exposing archived tasks. `TaskService.listTasks` filters them
  (`task-service/create-list.ts`, `isNull(tasks.archivedAt)`) and that behaviour is
  inherited unchanged.
- Any web or HTTP route change. This is MCP-surface only.

## Output format

Compact text, not JSON. The board is read by an agent at session start; the text render
costs roughly a third of the equivalent JSON and stays legible.

```
Board: project p1

## IDEAS (0)

## TODO (2)
- [t3] Fix auth bug [@alice] due:2026-08-01 #bug #api ^#ff0000
- [t7] Write docs due:2026-08-15 #docs

## DOING (1)
- [t2] Refactor service [@bob] due:2026-07-30 #refactor

## DONE (0)
```

Line grammar, in fixed order, each optional part omitted when the underlying field is
null or empty:

| Part      | Source            | Omitted when           |
| --------- | ----------------- | ---------------------- |
| `[id]`    | `task.id`         | never                  |
| title     | `task.title`      | never                  |
| `[@name]` | `task.doer`       | `doer` is null         |
| `due:...` | `task.endDate`    | never (always set)     |
| `#tag`    | `task.tags`       | `tags` is empty        |
| `^#hex`   | `backgroundColor` | `backgroundColor` null |

`due:` carries the date part only — `endDate.slice(0, 10)` — because board-level
scanning never needs the time component.

`^#hex` is the raw stored value, unmapped. No colour-name translation: the mapping
would be lossy and the project attaches no fixed semantics to board colours.

## Column handling

Columns are always rendered in the order `ideas, todo, doing, done`, including empty
ones, so a reader can tell "no tasks" from "column missing".

Within a column, tasks sort by `position` ascending — the order the user sees on
screen — with `id` ascending as the tie-break so the render is deterministic.

The count in the header, e.g. `## TODO (12)`, is the **total** number of tasks in that
column before any truncation.

## Truncation

`get_board` takes an optional `limitPerColumn` (integer, 1–200, default 50). When a
column holds more tasks than the limit, the extra lines are replaced by a single
overflow line:

```
- … 7 more (use list_tasks)
```

The header count still reports the full total, so the overflow is unambiguous.

## Architecture

Three files change, two are new.

**New — `apps/api/src/features/mcp/mcp-server/board-render.ts`**

```ts
export function renderBoard(
  tasks: TaskDto[],
  projectId: string,
  limitPerColumn: number,
): string;
```

A pure function. It takes no service and no MCP type, so it can be unit-tested on
plain `TaskDto` fixtures without an MCP server or a database. This is the single
implementation of the render; both the tool and the resource call it.

**New — `apps/api/src/features/mcp/mcp-server/board-tools.ts`**

```ts
export function registerBoardTools(
  server: McpServer,
  taskSvc: TaskService,
): void;
```

Registers one tool, matching the shape of the existing registrars in that directory:

- name: `get_board`
- description: "Full board snapshot in one call — every column with each task's doer,
  deadline, tags and colour. Use this at session start instead of several paginated
  list_tasks calls."
- input: `projectId: string`, `limitPerColumn: number` (int, 1–200, default 50)
- returns `textResult(renderBoard(taskSvc.listTasks(projectId), projectId, limitPerColumn))`

An unknown or empty project yields a board whose columns are all zero-count. No error
is raised: `listTasks` cannot distinguish a missing project from an empty one, and no
`ProjectService` is wired into this registrar. Adding one purely to validate the id
would widen the registrar's dependencies for no behavioural gain.

**Changed — `mcp-server/resources.ts`**

The inline render is deleted; the resource handler calls
`renderBoard(taskSvc.listTasks(id), id, 50)`. The resource output consequently gains
tags, colour and due date, matching the tool exactly — one render, two surfaces.

**Changed — `mcp.server.ts`**

Adds `registerBoardTools(server, taskSvc)` alongside the existing registrars.

## Testing

TDD. New file `apps/api/src/tests/features/mcp-board-tools.test.ts`, using the same
harness style as `mcp-task-list-tools.test.ts`: a stub `McpServer` that captures
registered handlers and a stub `TaskService` over in-memory `TaskDto` fixtures. No
database — the render depends on nothing the DB provides.

Cases:

1. Tasks are grouped under the right column headers, all four columns present.
2. Header counts equal the column totals.
3. Tasks within a column are ordered by `position` ascending.
4. A task with doer, tags and colour renders all three parts in the documented order.
5. A task with none of them renders only `- [id] title due:...`.
6. `limitPerColumn` truncates the list and emits the `… N more` line while the header
   count stays at the full total.
7. An empty project renders four zero-count columns.

`renderBoard` is covered through the tool handler rather than in a separate file, since
the tool adds nothing but argument plumbing.

## Risks

Low. The only existing behaviour that changes is the resource's render, which becomes
richer. No caller parses it programmatically — it is text meant for a model.
