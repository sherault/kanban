# Second Brain Toggle + Collapsible Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user turn the wiki sidebar's Second Brain panel on or off from profile preferences, and make the panel collapsible (collapsed by default) with count badges when on.

**Architecture:** A new `enable_second_brain` boolean column on `users` flows through the existing settings pipeline (Drizzle schema → `UserDto` → `normalizeUserSettings` → `PATCH /auth/me/settings`) and out to the web app, which already passes the whole current-user DTO into `ProjectClientLayout`. `WikiSidebar` renders `SecondBrainPanel` only when the flag is true. `SecondBrainPanel` is split into a `second-brain/` folder so a collapsed header can show inbox / review counts without mounting the body; collapse state lives in `localStorage`.

**Tech Stack:** Drizzle ORM + better-sqlite3, Hono, Zod, Vitest (API); Next.js 14 App Router + React + Tailwind (web); pnpm workspaces + Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-05-second-brain-toggle-design.md`

## Global Constraints

- Column name: `enable_second_brain`; TypeScript field name: `enableSecondBrain`; default `false`.
- The toggle is a **global user preference**. No per-project or per-org variant.
- Panel defaults to **collapsed**; collapse state persists in `localStorage` under the exact key `kanban_second_brain_collapsed`.
- No ORM types may leave `apps/api` — only DTOs from `packages/shared`.
- After changing `packages/shared`, rebuild it (`pnpm --filter @kanban/shared build`) before running typecheck. A stale bundled `dist/index.d.mts` produces misleading "property does not exist" errors in `apps/api` and `apps/web`.
- Drizzle with better-sqlite3: use `.returning().get()`, never array destructuring.
- Tests live in `apps/api/src/tests/`. Run with `cd apps/api && pnpm vitest run <path>`. `apps/web` has no unit tests — its `pnpm test` only runs contract scripts.
- Commits are GPG-signed. If a commit fails with `gpg: cannot open '/dev/tty'`, stop and report it instead of retrying in a loop.

---

## File Structure

**API**

- `apps/api/src/db/schema/identity.ts` — add the column (modify)
- `apps/api/drizzle/migrations/*` — generated migration (create)
- `packages/shared/src/dtos/identity.ts` — `UserDto.enableSecondBrain` (modify)
- `apps/api/src/features/identity/identity-service/base.ts` — row → DTO mapper (modify)
- `apps/api/src/features/identity/identity-service/types.ts` — `UserSettingsInput` (modify)
- `apps/api/src/features/identity/identity-service/totp-settings.ts` — `normalizeUserSettings` (modify)
- `apps/api/src/features/identity/identity-routes/schemas.ts` — `settingsSchema` (modify)
- `apps/api/src/tests/features/identity-second-brain-setting.test.ts` — route + default coverage (create)
- `apps/api/src/tests/features/identity-refactor-helpers.test.ts` — normalizer coverage (modify)

**Web — preference plumbing**

- `apps/web/src/lib/api/auth.ts` — `updateSettings` body type (modify)
- `apps/web/src/actions/profile.ts` — `updateSettingsAction` payload type (modify)
- `apps/web/src/components/profile/SettingsSection.tsx` — checkbox row (modify)
- `apps/web/src/components/ProfileModal.tsx` — pass initial value (modify)

**Web — wiki sidebar** (all under `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/`)

- `wiki-sidebar/second-brain/helpers.ts` — pure property helpers (create)
- `wiki-sidebar/second-brain/useSecondBrainData.ts` — scoped pages, captures, freshness, counts (create)
- `wiki-sidebar/second-brain/MiniButton.tsx` (create)
- `wiki-sidebar/second-brain/InboxCaptureRow.tsx` (create)
- `wiki-sidebar/second-brain/FreshnessRow.tsx` (create)
- `wiki-sidebar/second-brain/SecondBrainHeader.tsx` — chevron + title + badges (create)
- `wiki-sidebar/SecondBrainPanel.tsx` — shell only, ~150 lines (modify)
- `WikiSidebar.tsx` — conditional render (modify)
- `ProjectClientLayout.tsx` — prop type + pass-through (modify)

---

### Task 1: Add `enableSecondBrain` to the data model and user DTO

**Files:**

- Modify: `apps/api/src/db/schema/identity.ts:22-26`
- Modify: `packages/shared/src/dtos/identity.ts:1-12`
- Modify: `apps/api/src/features/identity/identity-service/base.ts:34-48`
- Create: `apps/api/drizzle/migrations/<generated>.sql`
- Create: `apps/api/src/tests/features/identity-second-brain-setting.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `users.enableSecondBrain` (Drizzle column, boolean mode); `UserDto.enableSecondBrain: boolean`; `toUserDto()` returns it.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/identity-second-brain-setting.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../../db/test-utils.js";
import { createApp } from "../../app.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  return { app, close: testDb.close };
}

const REGISTER_PAYLOAD = {
  email: "brain@example.com",
  password: "password123",
  displayName: "Brain",
};

describe("second brain user preference", () => {
  it("defaults to false for a newly registered user", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REGISTER_PAYLOAD),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { enableSecondBrain: boolean };
    };
    expect(body.user.enableSecondBrain).toBe(false);
    close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/tests/features/identity-second-brain-setting.test.ts`
Expected: FAIL — `expected undefined to be false`.

- [ ] **Step 3: Add the schema column**

In `apps/api/src/db/schema/identity.ts`, inside `users`, after `notificationDuration`:

```ts
  notificationDuration: integer("notification_duration").notNull().default(5),
  enableSecondBrain: integer("enable_second_brain", { mode: "boolean" })
    .notNull()
    .default(false),
```

- [ ] **Step 4: Add the DTO field**

In `packages/shared/src/dtos/identity.ts`, inside `UserDto`, after `notificationDuration`:

```ts
notificationDuration: number;
enableSecondBrain: boolean;
```

- [ ] **Step 5: Map the column in `toUserDto`**

In `apps/api/src/features/identity/identity-service/base.ts`, inside the returned object, after `notificationDuration`:

```ts
    notificationDuration: row.notificationDuration,
    enableSecondBrain: row.enableSecondBrain,
```

- [ ] **Step 6: Rebuild the shared package**

Run: `pnpm --filter @kanban/shared build`
Expected: `Build complete`. Verify the field made it into the bundle:
Run: `grep enableSecondBrain packages/shared/dist/index.d.mts`
Expected: one match. If there is no match, rerun the build — a stale bundle breaks the next steps with confusing type errors.

- [ ] **Step 7: Generate the migration**

Run: `cd apps/api && pnpm drizzle-kit generate`
Expected: a new file in `apps/api/drizzle/migrations/` containing
`ALTER TABLE \`users\` ADD \`enable_second_brain\` integer DEFAULT false NOT NULL;`Read the generated SQL and confirm it is exactly this one additive statement — if drizzle proposes a table rebuild or any`DROP`, stop and report.

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd apps/api && pnpm vitest run src/tests/features/identity-second-brain-setting.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full API suite and typecheck**

Run: `cd apps/api && pnpm vitest run`
Expected: all tests pass.
Run: `pnpm typecheck`
Expected: 3 successful tasks, no type errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/db/schema/identity.ts apps/api/drizzle/migrations packages/shared/src/dtos/identity.ts apps/api/src/features/identity/identity-service/base.ts apps/api/src/tests/features/identity-second-brain-setting.test.ts
git commit -m "feat(identity): add enableSecondBrain user preference column"
```

---

### Task 2: Accept `enableSecondBrain` in the settings update pipeline

**Files:**

- Modify: `apps/api/src/features/identity/identity-service/types.ts:32-37`
- Modify: `apps/api/src/features/identity/identity-service/totp-settings.ts:64-84`
- Modify: `apps/api/src/features/identity/identity-routes/schemas.ts:26-31`
- Modify: `apps/api/src/tests/features/identity-refactor-helpers.test.ts`
- Modify: `apps/api/src/tests/features/identity-second-brain-setting.test.ts`

**Interfaces:**

- Consumes: `UserDto.enableSecondBrain` and the `users.enableSecondBrain` column from Task 1.
- Produces: `PATCH /auth/me/settings` accepts `{ enableSecondBrain?: boolean }` and returns the updated `UserDto`; `normalizeUserSettings({ enableSecondBrain })` passes the boolean through unchanged.

- [ ] **Step 1: Write the failing normalizer test**

Append to the `describe("normalizeUserSettings", ...)` block in `apps/api/src/tests/features/identity-refactor-helpers.test.ts`:

```ts
it("passes enableSecondBrain through untouched", () => {
  expect(normalizeUserSettings({ enableSecondBrain: true })).toEqual({
    enableSecondBrain: true,
  });
  expect(normalizeUserSettings({ enableSecondBrain: false })).toEqual({
    enableSecondBrain: false,
  });
});
```

- [ ] **Step 2: Write the failing route test**

Append inside the `describe("second brain user preference", ...)` block in `apps/api/src/tests/features/identity-second-brain-setting.test.ts`:

```ts
async function registerAndLogin(app: ReturnType<typeof createApp>) {
  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(REGISTER_PAYLOAD),
  });
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: REGISTER_PAYLOAD.email,
      password: REGISTER_PAYLOAD.password,
    }),
  });
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

it("persists enableSecondBrain and returns it from /auth/me", async () => {
  const { app, close } = setup();
  const token = await registerAndLogin(app);

  const patch = await app.request("/auth/me/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ enableSecondBrain: true }),
  });
  expect(patch.status).toBe(200);
  const patched = (await patch.json()) as {
    user: { enableSecondBrain: boolean };
  };
  expect(patched.user.enableSecondBrain).toBe(true);

  const me = await app.request("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = (await me.json()) as { user: { enableSecondBrain: boolean } };
  expect(meBody.user.enableSecondBrain).toBe(true);
  close();
});

it("rejects a non-boolean enableSecondBrain", async () => {
  const { app, close } = setup();
  const token = await registerAndLogin(app);

  const res = await app.request("/auth/me/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ enableSecondBrain: "yes" }),
  });
  expect(res.status).toBe(400);
  close();
});
```

Note: the login response shape and the `/auth/me` response shape are the ones already asserted in `apps/api/src/tests/features/identity.test.ts` — read that file if a field name does not line up, and match it rather than inventing one.

- [ ] **Step 3: Run both test files to verify they fail**

Run: `cd apps/api && pnpm vitest run src/tests/features/identity-second-brain-setting.test.ts src/tests/features/identity-refactor-helpers.test.ts`
Expected: FAIL — the normalizer returns `{}`, and the PATCH returns the user without `enableSecondBrain` set (or a 400 from the Zod schema stripping the unknown key).

- [ ] **Step 4: Extend the settings input type**

In `apps/api/src/features/identity/identity-service/types.ts`, inside `UserSettingsInput`:

```ts
export interface UserSettingsInput {
  maxOpenPanels?: number | undefined;
  enableNotifications?: boolean | undefined;
  maxNotifications?: number | undefined;
  notificationDuration?: number | undefined;
  enableSecondBrain?: boolean | undefined;
}
```

- [ ] **Step 5: Extend the normalizer**

In `apps/api/src/features/identity/identity-service/totp-settings.ts`, inside `normalizeUserSettings`, after the `notificationDuration` spread:

```ts
    ...(settings.enableSecondBrain !== undefined && {
      enableSecondBrain: settings.enableSecondBrain,
    }),
```

- [ ] **Step 6: Extend the request schema**

In `apps/api/src/features/identity/identity-routes/schemas.ts`:

```ts
export const settingsSchema = z.object({
  maxOpenPanels: z.number().min(1).max(10).optional(),
  enableNotifications: z.boolean().optional(),
  maxNotifications: z.number().min(1).max(5).optional(),
  notificationDuration: z.number().min(1).max(30).optional(),
  enableSecondBrain: z.boolean().optional(),
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/tests/features/identity-second-brain-setting.test.ts src/tests/features/identity-refactor-helpers.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full API suite**

Run: `cd apps/api && pnpm vitest run`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/features/identity apps/api/src/tests/features
git commit -m "feat(identity): accept enableSecondBrain in settings update"
```

---

### Task 3: Expose the toggle in profile preferences

**Files:**

- Modify: `apps/web/src/lib/api/auth.ts:71-84`
- Modify: `apps/web/src/actions/profile.ts` (`updateSettingsAction`)
- Modify: `apps/web/src/components/profile/SettingsSection.tsx`
- Modify: `apps/web/src/components/ProfileModal.tsx:76-81`

**Interfaces:**

- Consumes: `UserDto.enableSecondBrain` (Task 1); `PATCH /auth/me/settings` accepting `enableSecondBrain` (Task 2).
- Produces: `SettingsSection` prop `initialEnableSecondBrain: boolean`.

- [ ] **Step 1: Widen the API client body type**

In `apps/web/src/lib/api/auth.ts`, in `updateSettings`:

```ts
  updateSettings(
    token: string,
    body: {
      maxOpenPanels?: number;
      enableNotifications?: boolean;
      maxNotifications?: number;
      notificationDuration?: number;
      enableSecondBrain?: boolean;
    },
  ) {
```

- [ ] **Step 2: Widen the server action payload type**

In `apps/web/src/actions/profile.ts`:

```ts
export async function updateSettingsAction(updates: {
  maxOpenPanels?: number;
  enableNotifications?: boolean;
  maxNotifications?: number;
  notificationDuration?: number;
  enableSecondBrain?: boolean;
}) {
```

Leave the body of the function unchanged.

- [ ] **Step 3: Add the checkbox to `SettingsSection`**

In `apps/web/src/components/profile/SettingsSection.tsx`:

a) Add to `interface Props`: `initialEnableSecondBrain: boolean;`

b) Add to the destructured params: `initialEnableSecondBrain,`

c) Add state after the `notificationDuration` state:

```tsx
const [enableSecondBrain, setEnableSecondBrain] = useState(
  initialEnableSecondBrain,
);
```

d) Add to the `handleUpdate` `updates` parameter type: `enableSecondBrain?: boolean;`

e) Add inside `handleUpdate`, after the `notificationDuration` assignment:

```tsx
if (updates.enableSecondBrain !== undefined)
  setEnableSecondBrain(updates.enableSecondBrain);
```

f) Add a new card at the end of the `<section>`, after the notifications card's closing `</div>`:

```tsx
<div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
  <div className="flex items-center justify-between mb-2">
    <label className="text-sm font-medium text-gray-700">
      Enable Second Brain
    </label>
    <input
      type="checkbox"
      checked={enableSecondBrain}
      disabled={saving}
      onChange={(e) => handleUpdate({ enableSecondBrain: e.target.checked })}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    />
  </div>
  <p className="mt-1 text-xs text-gray-400 italic">
    Show the capture inbox and review-due panel in the wiki sidebar.
  </p>
</div>
```

- [ ] **Step 4: Pass the initial value from `ProfileModal`**

In `apps/web/src/components/ProfileModal.tsx`:

```tsx
<SettingsSection
  initialMaxOpenPanels={data.me.maxOpenPanels}
  initialEnableNotifications={data.me.enableNotifications}
  initialMaxNotifications={data.me.maxNotifications}
  initialNotificationDuration={data.me.notificationDuration}
  initialEnableSecondBrain={data.me.enableSecondBrain}
/>
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. If `enableSecondBrain` is reported as missing on `UserDto`, rebuild shared: `pnpm --filter @kanban/shared build`.

- [ ] **Step 6: Verify manually**

Run: `pnpm dev`. Open the profile/settings modal → Preferences. The "Enable Second Brain" checkbox appears, starts unchecked, and stays checked after a page reload.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api/auth.ts apps/web/src/actions/profile.ts apps/web/src/components/profile/SettingsSection.tsx apps/web/src/components/ProfileModal.tsx
git commit -m "feat(web): add Second Brain toggle to profile preferences"
```

---

### Task 4: Split `SecondBrainPanel` into a `second-brain/` folder (no behaviour change)

All paths in this task are relative to
`apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/`.

**Files:**

- Create: `wiki-sidebar/second-brain/helpers.ts`
- Create: `wiki-sidebar/second-brain/MiniButton.tsx`
- Create: `wiki-sidebar/second-brain/InboxCaptureRow.tsx`
- Create: `wiki-sidebar/second-brain/FreshnessRow.tsx`
- Create: `wiki-sidebar/second-brain/useSecondBrainData.ts`
- Modify: `wiki-sidebar/SecondBrainPanel.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `helpers.ts`: `isCaptureInboxPage(page: WikiPageSummaryDto): boolean`, `isInboxCapture(page: WikiPageSummaryDto): boolean`, `freshnessReasons(page: WikiPageSummaryDto): string[]`, `stringProperty(value: unknown, fallback?: string): string`, `arrayProperty(value: unknown): string[]`, `objectProperty(value: unknown): Record<string, unknown>`
  - `useSecondBrainData(pages: WikiPageSummaryDto[], projectId: string)` returning `{ inboxPage: WikiPageSummaryDto | undefined; inboxCaptures: WikiPageSummaryDto[]; freshnessPages: Array<{ page: WikiPageSummaryDto; reasons: string[] }>; inboxCount: number; reviewCount: number }`
  - `MiniButton`, `InboxCaptureRow`, `FreshnessRow` — same props they have today inside `SecondBrainPanel.tsx`

This is a pure move. Copy the existing function bodies **verbatim**; do not rewrite logic, class names, or copy.

- [ ] **Step 1: Create `helpers.ts`**

Move these functions out of `SecondBrainPanel.tsx` verbatim into
`wiki-sidebar/second-brain/helpers.ts`, exporting each:
`isCaptureInboxPage`, `isInboxCapture`, `freshnessReasons`, `isDueDate`,
`todayString`, `stringProperty`, `arrayProperty`, `objectProperty`.

`isDueDate` and `todayString` stay module-private (no `export`). The file needs
one import:

```ts
import type { WikiPageSummaryDto } from "@kanban/shared";
```

- [ ] **Step 2: Create `MiniButton.tsx`**

Move the `MiniButton` function verbatim into
`wiki-sidebar/second-brain/MiniButton.tsx`, with `"use client";` as the first
line and `export function MiniButton(...)`. It needs no imports beyond React
types already inferred (`children: React.ReactNode` requires
`import type React from "react";`).

- [ ] **Step 3: Create `InboxCaptureRow.tsx` and `FreshnessRow.tsx`**

Move `InboxCaptureRow` and `FreshnessRow` verbatim into their own files, each
starting with `"use client";` and exporting the component. Their imports:

```ts
import type { WikiPageSummaryDto } from "@kanban/shared";
import { MiniButton } from "./MiniButton";
import { arrayProperty } from "./helpers"; // InboxCaptureRow only
import { objectProperty } from "./helpers"; // FreshnessRow only
```

- [ ] **Step 4: Create `useSecondBrainData.ts`**

```ts
"use client";

import { useMemo } from "react";
import type { WikiPageSummaryDto } from "@kanban/shared";
import {
  freshnessReasons,
  isCaptureInboxPage,
  isInboxCapture,
} from "./helpers";

export function useSecondBrainData(
  pages: WikiPageSummaryDto[],
  projectId: string,
) {
  return useMemo(() => {
    const scopedPages = pages.filter(
      (page) => page.projectId === null || page.projectId === projectId,
    );
    const inboxPage = scopedPages.find(isCaptureInboxPage);
    const inboxCaptures = scopedPages.filter(isInboxCapture);
    const freshnessPages = scopedPages
      .map((page) => ({ page, reasons: freshnessReasons(page) }))
      .filter((item) => !isInboxCapture(item.page) && item.reasons.length > 0);

    return {
      inboxPage,
      inboxCaptures,
      freshnessPages,
      inboxCount: inboxCaptures.length,
      reviewCount: freshnessPages.length,
    };
  }, [pages, projectId]);
}
```

- [ ] **Step 5: Rewire `SecondBrainPanel.tsx`**

Delete the moved functions from `SecondBrainPanel.tsx`. Replace the local
`scopedPages` / `inboxPage` / `inboxCaptures` / `freshnessPages` derivation
(the `useMemo` block and the three `const` lines after it) with:

```tsx
const { inboxPage, inboxCaptures, freshnessPages } = useSecondBrainData(
  pages,
  projectId,
);
```

Add imports:

```ts
import { FreshnessRow } from "./second-brain/FreshnessRow";
import { InboxCaptureRow } from "./second-brain/InboxCaptureRow";
import { useSecondBrainData } from "./second-brain/useSecondBrainData";
```

Remove the now-unused `useMemo` import. Keep `SecondBrainGroup`, `StatusPill`,
and `PlusIcon` in `SecondBrainPanel.tsx`. The JSX is unchanged.

- [ ] **Step 6: Verify no behaviour changed**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors, no unused-import warnings.
Run: `wc -l "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/wiki-sidebar/SecondBrainPanel.tsx"`
Expected: roughly 200 lines or fewer (was 466).

Run `pnpm dev`, open a project's Wiki tab, and confirm the panel looks and
behaves exactly as before: capture button opens the form, saving a capture
creates a page, inbox and review rows render with their buttons.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/wiki-sidebar"
git commit -m "refactor(web): split SecondBrainPanel into second-brain modules"
```

---

### Task 5: Make the panel collapsible with count badges

All paths relative to
`apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/`.

**Files:**

- Create: `wiki-sidebar/second-brain/SecondBrainHeader.tsx`
- Modify: `wiki-sidebar/SecondBrainPanel.tsx`

**Interfaces:**

- Consumes: `useSecondBrainData` (Task 4), specifically `inboxCount` and `reviewCount`.
- Produces: `SecondBrainHeader` with props `{ collapsed: boolean; onToggle: () => void; inboxCount: number; reviewCount: number; onCapture: () => void; captureDisabled: boolean }`.

- [ ] **Step 1: Create `SecondBrainHeader.tsx`**

```tsx
"use client";

export const SECOND_BRAIN_COLLAPSED_KEY = "kanban_second_brain_collapsed";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  inboxCount: number;
  reviewCount: number;
  onCapture: () => void;
  captureDisabled: boolean;
}

export function SecondBrainHeader({
  collapsed,
  onToggle,
  inboxCount,
  reviewCount,
  onCapture,
  captureDisabled,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand Second Brain" : "Collapse Second Brain"}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-gray-100"
      >
        <ChevronIcon collapsed={collapsed} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Second Brain
        </span>
        {inboxCount > 0 && <CountBadge label="Inbox" value={inboxCount} />}
        {reviewCount > 0 && <CountBadge label="Review" value={reviewCount} />}
      </button>
      <button
        type="button"
        title="Create capture"
        onClick={onCapture}
        disabled={captureDisabled}
        className="h-8 w-8 shrink-0 rounded-md border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
      {label} {value}
    </span>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${
        collapsed ? "" : "rotate-90"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mx-auto h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Add collapse state to `SecondBrainPanel`**

In `wiki-sidebar/SecondBrainPanel.tsx`, add the import:

```ts
import {
  SECOND_BRAIN_COLLAPSED_KEY,
  SecondBrainHeader,
} from "./second-brain/SecondBrainHeader";
```

Add `useEffect` to the `react` import, and add this state next to the other
`useState` calls. It starts collapsed so the server-rendered and first
client-rendered markup match; the stored value is applied after hydration:

```tsx
const [collapsed, setCollapsed] = useState(true);

useEffect(() => {
  setCollapsed(
    window.localStorage.getItem(SECOND_BRAIN_COLLAPSED_KEY) !== "false",
  );
}, []);

const toggleCollapsed = () => {
  setCollapsed((previous) => {
    const next = !previous;
    window.localStorage.setItem(SECOND_BRAIN_COLLAPSED_KEY, String(next));
    if (next) setIsCaptureOpen(false);
    return next;
  });
};
```

Also pull the counts from the hook:

```tsx
const { inboxPage, inboxCaptures, freshnessPages, inboxCount, reviewCount } =
  useSecondBrainData(pages, projectId);
```

- [ ] **Step 3: Swap the old header for `SecondBrainHeader` and gate the body**

Replace the header block (the `<div className="flex items-center justify-between gap-2">…</div>` containing the `<h2>`, the two `StatusPill`s, and the plus button) with:

```tsx
<SecondBrainHeader
  collapsed={collapsed}
  onToggle={toggleCollapsed}
  inboxCount={inboxCount}
  reviewCount={reviewCount}
  onCapture={() => {
    setCollapsed(false);
    window.localStorage.setItem(SECOND_BRAIN_COLLAPSED_KEY, "false");
    setIsCaptureOpen((open) => !open);
  }}
  captureDisabled={isPending}
/>
```

Wrap everything below the header (the `notice` paragraph, the capture form, and
both `SecondBrainGroup` blocks) in:

```tsx
{
  !collapsed && (
    <div className="max-h-64 overflow-y-auto scrollbar-thin">
      {/* notice, capture form, Inbox group, Review Due group */}
    </div>
  );
}
```

Delete the now-unused `StatusPill` and `PlusIcon` functions from
`SecondBrainPanel.tsx` (both now live in `SecondBrainHeader.tsx`).

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors and no unused-symbol warnings.

- [ ] **Step 5: Verify manually**

Run `pnpm dev`, open a project's Wiki tab (with the preference enabled via the
profile toggle from Task 3, or by flipping the DB value):

- Panel starts collapsed: one header row, badges only when counts are non-zero.
- Clicking the header expands it; the wiki tree keeps its space and the body
  scrolls once it passes ~16rem.
- Reloading keeps the last expanded/collapsed state.
- No hydration warning in the browser console.
- The plus button expands the panel and opens the capture form.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/wiki-sidebar"
git commit -m "feat(web): make Second Brain panel collapsible with count badges"
```

---

### Task 6: Render the panel only when the preference is on

All web paths relative to
`apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/`.

**Files:**

- Modify: `ProjectClientLayout.tsx:20-27` (Props) and `:150-155` (`WikiSidebar` usage)
- Modify: `WikiSidebar.tsx`

**Interfaces:**

- Consumes: `UserDto.enableSecondBrain` (Task 1); `SecondBrainPanel` (Tasks 4–5).
- Produces: `WikiSidebar` prop `enableSecondBrain: boolean`.

- [ ] **Step 1: Widen the layout prop type**

In `ProjectClientLayout.tsx`, in `interface Props`:

```ts
userPreferences: {
  maxOpenPanels: number;
  enableNotifications: boolean;
  maxNotifications: number;
  notificationDuration: number;
  enableSecondBrain: boolean;
}
```

`layout.tsx` passes `userPreferences={me}` (the whole `UserDto`), so no change is
needed there.

- [ ] **Step 2: Pass the flag to `WikiSidebar`**

In `ProjectClientLayout.tsx`:

```tsx
<WikiSidebar
  orgId={orgId}
  projectId={projectId}
  onRefresh={fetchPages}
  enableSecondBrain={userPreferences.enableSecondBrain}
/>
```

- [ ] **Step 3: Gate the panel in `WikiSidebar`**

In `WikiSidebar.tsx`, add to `interface Props`:

```ts
enableSecondBrain: boolean;
```

Destructure it in the component signature, and replace the unconditional panel:

```tsx
{
  enableSecondBrain && (
    <SecondBrainPanel
      orgId={orgId}
      projectId={projectId}
      pages={pages}
      onRefresh={onRefresh}
    />
  );
}
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 5: Verify manually end to end**

Run `pnpm dev`:

- Preference off (default): the Wiki sidebar shows header + tree + create button
  and no Second Brain UI at all.
- Toggle it on in profile preferences, reload: the collapsed Second Brain header
  appears at the top of the Wiki sidebar.
- Toggle it off again, reload: it disappears.

- [ ] **Step 6: Run the whole test suite**

Run: `pnpm test`
Expected: API suite passes; web contract checks pass.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]"
git commit -m "feat(web): gate Second Brain panel on user preference"
```

---

## Verification Checklist

- [ ] `pnpm test` passes from the repo root.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build` passes.
- [ ] Migration file in `apps/api/drizzle/migrations/` is a single additive
      `ALTER TABLE` and is committed.
- [ ] A fresh user sees no Second Brain UI until they enable it.
- [ ] With it enabled, the panel is collapsed by default, badges show non-zero
      counts, and the collapse state survives a reload.
