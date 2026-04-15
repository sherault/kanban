# Real-Time Board via WebSockets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Kanban board to the API's existing WebSocket infrastructure so that all users viewing the same project board see task changes (create, update, delete, move) in real time.

**Architecture:** The API already broadcasts `task.created / task.updated / task.deleted` events to `project:{projectId}` rooms on every mutation — no API changes needed. The web client opens one persistent WS connection per browser session (authenticated via short-lived token fetched from a Next.js route handler), subscribes to the active project room, and applies incoming events directly to the existing `useState` task list in `BoardClient`. TanStack Query is installed and wired up as a provider now (it will own data fetching in Plan 7); for this plan the WS hook uses it only for cache invalidation helpers, not as the primary state store. Events for a task the user currently has open in the sidebar are silently discarded to avoid overwriting in-progress edits.

**Tech Stack:** `@tanstack/react-query`, native browser `WebSocket` API, Next.js Route Handlers (App Router), React `useRef` / `useEffect` / `useCallback`

---

## File Map

| Action | File                                                                       | Purpose                                          |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Create | `apps/web/src/lib/query.ts`                                                | QueryClient factory (server-safe singleton)      |
| Create | `apps/web/src/components/Providers.tsx`                                    | `QueryClientProvider` client wrapper             |
| Modify | `apps/web/src/app/(app)/layout.tsx`                                        | Wrap shell with `<Providers>`                    |
| Create | `apps/web/src/app/api/auth/token/route.ts`                                 | GET → `{ token }` using httpOnly cookie          |
| Create | `apps/web/src/hooks/useProjectSocket.ts`                                   | WS hook: connect, subscribe, reconnect, dispatch |
| Modify | `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx` | Add `useProjectSocket`; handle WS events         |

---

## API Reference

WebSocket endpoint (already live in `apps/api`):

```
WS  /ws?token=<accessToken>
```

On connect the server auto-subscribes the user to their org rooms. To subscribe to task events for a specific project the client sends:

```json
{ "type": "subscribe", "room": "project:{projectId}" }
```

Events the client will receive (from `apps/api/src/types.ts`):

```typescript
{
  type: "task.created";
  payload: TaskDto;
}
{
  type: "task.updated";
  payload: TaskDto;
}
{
  type: "task.deleted";
  payload: {
    id: string;
    projectId: string;
  }
}
```

The WS URL for the browser is `process.env.WS_URL` (default `ws://localhost:3001`). The full connection URL is `${WS_URL}/ws?token=<token>`.

---

## Task 1: TanStack Query Provider Setup

**Files:**

- Create: `apps/web/src/lib/query.ts`
- Create: `apps/web/src/components/Providers.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Install @tanstack/react-query**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm add --filter @kanban/web @tanstack/react-query
```

Expected: package added to `apps/web/package.json` dependencies.

- [ ] **Step 2: Create QueryClient factory**

Create `apps/web/src/lib/query.ts`:

```typescript
import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 seconds — avoids redundant refetches
        // on tab focus. WS events keep the cache up to date instead.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a stable QueryClient.
 * - Server: always a fresh instance (prevents cross-request state leaks).
 * - Browser: singleton so the cache persists across renders.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

- [ ] **Step 3: Create Providers client wrapper**

Create `apps/web/src/components/Providers.tsx`:

```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { getQueryClient } from "../lib/query";

export function Providers({ children }: { children: ReactNode }) {
  // getQueryClient() returns the browser singleton — stable across re-renders
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 4: Wrap app shell with Providers**

Read `apps/web/src/app/(app)/layout.tsx` first. Replace it with:

```tsx
import Link from "next/link";
import { getUserName } from "../../lib/session";
import { logoutAction } from "../../actions/auth";
import { Providers } from "../../components/Providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const displayName = await getUserName();

  return (
    <Providers>
      <div className="h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <Link
            href="/orgs"
            className="font-bold text-gray-900 text-lg tracking-tight"
          >
            Kanban
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{displayName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </Providers>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm build --filter @kanban/web
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/stephane/projects/saas/kanban
git add apps/web/package.json pnpm-lock.yaml \
        apps/web/src/lib/query.ts \
        apps/web/src/components/Providers.tsx \
        "apps/web/src/app/(app)/layout.tsx"
git commit -m "feat: install TanStack Query and wire QueryClientProvider into app shell"
```

---

## Task 2: Token Route Handler

The browser needs an access token to authenticate the WebSocket connection, but `access_token` is an httpOnly cookie (invisible to JavaScript). A Next.js Route Handler runs server-side with full cookie access, so it can safely proxy the token.

**Files:**

- Create: `apps/web/src/app/api/auth/token/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/auth/token/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAccessToken } from "../../../../lib/session";

/**
 * GET /api/auth/token
 *
 * Returns the current access token so client-side code (WS hook) can
 * authenticate without having direct access to the httpOnly cookie.
 *
 * This endpoint is same-origin only — no CORS headers intentionally.
 */
export async function GET(): Promise<NextResponse> {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm build --filter @kanban/web
```

Expected: route `/api/auth/token` appears in build output as a dynamic route. `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
cd /Users/stephane/projects/saas/kanban
git add apps/web/src/app/api/auth/token/route.ts
git commit -m "feat: token route handler for client-side WS authentication"
```

---

## Task 3: `useProjectSocket` Hook

**Files:**

- Create: `apps/web/src/hooks/useProjectSocket.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/useProjectSocket.ts`:

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TaskDto } from "@kanban/shared";

const WS_BASE = process.env["NEXT_PUBLIC_WS_URL"] ?? "ws://localhost:3001";

/** Subset of WsEvent from apps/api/src/types.ts — only task events needed here. */
type IncomingEvent =
  | { type: "task.created"; payload: TaskDto }
  | { type: "task.updated"; payload: TaskDto }
  | { type: "task.deleted"; payload: { id: string; projectId: string } };

export interface ProjectSocketCallbacks {
  onTaskCreated: (task: TaskDto) => void;
  onTaskUpdated: (task: TaskDto) => void;
  onTaskDeleted: (taskId: string) => void;
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Opens a WebSocket connection to the API, subscribes to the given project
 * room, and calls the provided callbacks when task events arrive.
 *
 * Reconnects automatically with exponential backoff (100ms → 200 → 400 → …
 * up to 30 s). Cleans up on unmount.
 *
 * @param projectId  The project room to subscribe to.
 * @param callbacks  Handler functions for each event type. Stable refs are
 *                   maintained internally — you do NOT need to memoize these.
 */
export function useProjectSocket(
  projectId: string,
  callbacks: ProjectSocketCallbacks,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);

  // Keep a stable ref to callbacks so the WebSocket handlers always call
  // the latest version without triggering reconnect.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const unmountedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(async () => {
    if (unmountedRef.current) return;

    const token = await fetchToken();
    if (!token || unmountedRef.current) return;

    const ws = new WebSocket(
      `${WS_BASE}/ws?token=${encodeURIComponent(token)}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      // Reset backoff counter on successful connect
      attemptRef.current = 0;
      setIsConnected(true);
      ws.send(
        JSON.stringify({ type: "subscribe", room: `project:${projectId}` }),
      );
    };

    ws.onmessage = (event) => {
      let msg: IncomingEvent;
      try {
        msg = JSON.parse(event.data as string) as IncomingEvent;
      } catch {
        return; // ignore malformed frames
      }

      switch (msg.type) {
        case "task.created":
          callbacksRef.current.onTaskCreated(msg.payload);
          break;
        case "task.updated":
          callbacksRef.current.onTaskUpdated(msg.payload);
          break;
        case "task.deleted":
          callbacksRef.current.onTaskDeleted(msg.payload.id);
          break;
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      ws.close();
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (unmountedRef.current) return;

      // Exponential backoff: 100ms × 2^attempt, capped at 30 s
      const backoff = Math.min(100 * 2 ** attemptRef.current, 30_000);
      attemptRef.current += 1;
      setTimeout(connect, backoff);
    };
  }, [projectId]);

  useEffect(() => {
    unmountedRef.current = false;
    void connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { isConnected };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm build --filter @kanban/web
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
cd /Users/stephane/projects/saas/kanban
git add apps/web/src/hooks/useProjectSocket.ts
git commit -m "feat: useProjectSocket hook with exponential-backoff reconnect"
```

---

## Task 4: Integrate Real-Time into BoardClient

**Files:**

- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx`

- [ ] **Step 1: Read the current BoardClient**

Read `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx` to understand the current state.

- [ ] **Step 2: Replace BoardClient with the real-time version**

Replace `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx` entirely:

```tsx
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { TaskDto, MembershipDto } from "@kanban/shared";
import { Column } from "@kanban/shared";
import { moveTaskAction } from "@/actions/tasks";
import { useProjectSocket } from "@/hooks/useProjectSocket";
import { TaskCard } from "./TaskCard";
import { BoardColumn } from "./BoardColumn";
import { NewTaskModal } from "./NewTaskModal";
import { TaskDetailSidebar } from "./TaskDetailSidebar";

const COLUMNS: { id: Column; label: string }[] = [
  { id: Column.IDEAS, label: "Ideas" },
  { id: Column.TODO, label: "To Do" },
  { id: Column.DOING, label: "Doing" },
  { id: Column.DONE, label: "Done" },
];

interface Props {
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
}

export function BoardClient({
  initialTasks,
  orgMembers,
  projectId,
  orgId,
}: Props) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<Column | null>(null);
  const [ideasCollapsed, setIdeasCollapsed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep a ref to selectedTaskId so WS callbacks (closures) always read
  // the latest value without needing to be recreated on every render.
  const selectedTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── WebSocket real-time ───────────────────────────────────────────────────

  const { isConnected } = useProjectSocket(projectId, {
    onTaskCreated(task) {
      // Ignore if we already have the task (e.g. from our own Server Action)
      setTasks((prev) =>
        prev.some((t) => t.id === task.id) ? prev : [...prev, task],
      );
    },
    onTaskUpdated(task) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t;
          // Don't overwrite a task the user has open in the sidebar —
          // their in-progress edits take precedence until they close it.
          if (selectedTaskIdRef.current === task.id) return t;
          return task;
        }),
      );
    },
    onTaskDeleted(taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskIdRef.current === taskId) setSelectedTaskId(null);
    },
  });

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newColumn = over.id as Column;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.column === newColumn) return;

    if (newColumn === Column.DOING && !task.doer) {
      setError("Assign a doer to this task before moving it to Doing.");
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: newColumn } : t)),
    );

    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, newColumn);
      if (result.error) {
        // Revert to original column
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, column: task.column } : t,
          ),
        );
        setError(result.error);
      } else if (result.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === result.task!.id ? result.task! : t)),
        );
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error banner */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 flex items-center justify-between shrink-0">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 text-red-400 hover:text-red-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          {/* Board columns */}
          <div className="flex gap-4 p-6 overflow-x-auto flex-1 items-start">
            {COLUMNS.map(({ id, label }) => (
              <BoardColumn
                key={id}
                column={id}
                label={label}
                tasks={tasks.filter((t) => t.column === id)}
                collapsed={id === Column.IDEAS ? ideasCollapsed : false}
                onToggleCollapse={
                  id === Column.IDEAS
                    ? () => setIdeasCollapsed((v) => !v)
                    : undefined
                }
                onTaskClick={(taskId) => setSelectedTaskId(taskId)}
                onNewTask={() => setNewTaskColumn(id)}
              />
            ))}
          </div>

          {/* Connection status indicator */}
          <div className="px-6 pb-3 flex items-center gap-1.5 shrink-0">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-300"}`}
            />
            <span className="text-xs text-gray-400">
              {isConnected ? "Live" : "Connecting…"}
            </span>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} onClick={() => {}} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          orgMembers={orgMembers}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={(updated) =>
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t)),
            )
          }
          onDeleted={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            setSelectedTaskId(null);
          }}
        />
      )}

      {newTaskColumn !== null && (
        <NewTaskModal
          projectId={projectId}
          orgId={orgId}
          initialColumn={newTaskColumn}
          onClose={() => setNewTaskColumn(null)}
          onCreated={(task) => {
            setTasks((prev) => [...prev, task]);
            setNewTaskColumn(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm build --filter @kanban/web
```

Expected: `✓ Compiled successfully`. All routes present including `ƒ /orgs/[orgId]/projects/[projectId]`.

- [ ] **Step 4: Verify lint**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm lint --filter @kanban/web
```

Expected: no errors.

- [ ] **Step 5: Verify API tests still pass**

```bash
cd /Users/stephane/projects/saas/kanban && rtk pnpm test --filter @kanban/api
```

Expected: `Test Files 21 passed (21)`, `Tests 106 passed (106)`.

- [ ] **Step 6: Commit**

```bash
cd /Users/stephane/projects/saas/kanban
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/BoardClient.tsx"
git commit -m "feat: real-time board — integrate useProjectSocket with live status indicator"
```

---

## Manual Verification Steps

After all tasks are committed, verify end-to-end in two browser windows:

1. Start the API: `cd apps/api && pnpm dev`
2. Start the web: `cd apps/web && pnpm dev`
3. Log in as User A in Window 1, navigate to a project board.
4. Log in as User B in Window 2, navigate to the **same** project board.
5. User A creates a task via `+ New task` → task appears in Window 2 within ~1 s.
6. User A drags a task to a different column → column change appears in Window 2.
7. User A opens the task detail sidebar and edits the title → Window 2 does NOT show the mid-edit state.
8. User A saves (blur) and closes the sidebar → Window 2 now reflects the saved title (via a future WS `task.updated` from User B's own action, or on next open).
9. Disconnect the API briefly → both boards show "Connecting…" indicator, reconnect within ~30 s.

---

## Self-Review

### Spec Coverage

| Requirement (from design doc §6)                                  | Task                                |
| ----------------------------------------------------------------- | ----------------------------------- |
| One WS connection per session, auth via `?token=<accessToken>`    | Task 3 (`fetchToken` + connect URL) |
| Auto-subscribe to org rooms on connect                            | API already handles this            |
| Client sends `{ type: "subscribe", room: "project:{projectId}" }` | Task 3 (`ws.onopen`)                |
| `task.created / updated / deleted` events                         | Task 3 (switch in `onmessage`)      |
| WS events do not overwrite field being actively edited            | Task 4 (`selectedTaskIdRef` guard)  |
| Reconnect with exponential backoff, max 30 s                      | Task 3 (`onclose` + `setTimeout`)   |
| TanStack Query installed                                          | Task 1                              |

### Placeholder Scan

No TBDs, TODOs, or incomplete sections. All code blocks are complete.

### Type Consistency

- `useProjectSocket` returns `{ isConnected: boolean }` — used in Task 4 as `const { isConnected } = useProjectSocket(...)` ✓
- `ProjectSocketCallbacks.onTaskDeleted` receives `taskId: string` — Task 4 calls `setSelectedTaskId(null)` when `selectedTaskIdRef.current === taskId` ✓
- `IncomingEvent` in `useProjectSocket` matches `WsEvent` in `apps/api/src/types.ts` exactly ✓
