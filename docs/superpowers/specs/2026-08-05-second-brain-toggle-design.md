# Second Brain: user toggle + collapsible sidebar panel

**Date:** 2026-08-05
**Status:** Approved design

## Problem

The Second Brain panel (`SecondBrainPanel`) renders unconditionally at the top of
the wiki sidebar. Users who do not use the feature cannot remove it, and users who
do use it lose too much vertical space to it — the wiki page tree is pushed down.

## Goals

1. Users can turn the Second Brain panel on or off from their profile preferences.
2. When on, the panel is collapsible and defaults to collapsed, with badge counts
   visible in the collapsed header so pending items are still discoverable.
3. When off, the wiki sidebar shows no Second Brain UI at all.

## Non-goals

- Per-project or per-organization control. The toggle is a global user preference.
- Changes to Second Brain behaviour itself (capture, triage, freshness rules).
- Changes to the MCP second-brain tools.

## Decisions

| Decision             | Choice                           | Reason                                                                             |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| Toggle scope         | Global user preference           | Matches the existing `maxOpenPanels` / `enableNotifications` pattern; no new table |
| Default value        | `false` (off)                    | Existing users get a clean sidebar; the feature is opt-in                          |
| Collapse UX          | Chevron header with count badges | Collapsed panel still signals pending inbox / review items                         |
| Collapse persistence | `localStorage`, per browser      | UI-only state; not worth a DB round trip                                           |
| Collapse default     | Collapsed                        | Minimum footprint until the user asks for it                                       |

## Data model

`users` table gains one column:

```ts
enableSecondBrain: integer("enable_second_brain", { mode: "boolean" })
  .notNull()
  .default(false),
```

Migration generated with `cd apps/api && pnpm drizzle-kit generate` and committed
under `apps/api/drizzle/migrations/`. Additive with a default, so existing rows
are backward compatible.

## API changes

- `packages/shared/src/dtos/identity.ts`: add `enableSecondBrain: boolean` to the
  user DTO. The shared package must be rebuilt so the bundled `index.d.mts`
  re-exports the new field; a stale bundle causes API typecheck failures.
- `apps/api/src/features/identity/identity-service/base.ts`: map the row column
  into the DTO.
- `apps/api/src/features/identity/identity-service/types.ts`: add
  `enableSecondBrain?: boolean | undefined` to the update-settings input type.
- `apps/api/src/features/identity/identity-service/totp-settings.ts`: add the
  conditional update branch alongside the existing settings fields.
- `apps/api/src/features/identity/identity-routes/schemas.ts`: extend
  `settingsSchema` with `enableSecondBrain: z.boolean().optional()`.

## Web changes

### Preferences UI

`apps/web/src/components/profile/SettingsSection.tsx` gains a checkbox row
"Enable Second Brain" with a one-line hint, following the existing
"Enable Live Notifications" markup and the shared `handleUpdate` flow.
`apps/web/src/actions/profile.ts` widens the settings-update payload type.

### Wiring the preference to the sidebar

`ProjectClientLayout` already receives a `userPreferences` object; add
`enableSecondBrain: boolean` to it and pass the flag into `WikiSidebar` (which
today receives no preferences). The project `layout.tsx` already passes the whole
current-user DTO (`userPreferences={me}`), so the field flows through once the DTO
carries it — only the prop type needs widening.

`WikiSidebar` renders `<SecondBrainPanel>` only when the flag is true. When
false the sidebar is header + page tree + create button, with no reserved space.

### Collapsible panel

- New `wiki-sidebar/second-brain/SecondBrainHeader.tsx`: a button row with a
  chevron (▸ collapsed, ▾ expanded), the label "SECOND BRAIN", and two count
  badges (inbox captures, review-due pages). A badge is hidden when its count is
  zero.
- Collapsed state is stored in `localStorage` under
  `kanban_second_brain_collapsed`. The component renders collapsed on first paint
  and reads the stored value in a `useEffect`, so server and client markup match
  on hydration.
- The expanded body is capped at `max-h-64` with `overflow-y-auto`, so a large
  inbox can never push the page tree off screen.

### Targeted refactor

`SecondBrainPanel.tsx` is 466 lines and mixes shell, data derivation, row
components, and property helpers. Since the header needs the counts even while
the body is collapsed, split it:

- `second-brain/helpers.ts` — `isCaptureInboxPage`, `isInboxCapture`,
  `freshnessReasons`, `arrayProperty`
- `second-brain/useSecondBrainData.ts` — scoped pages, inbox captures,
  freshness pages, and the two counts
- `second-brain/InboxCaptureRow.tsx`, `second-brain/FreshnessRow.tsx`,
  `second-brain/MiniButton.tsx`
- `SecondBrainPanel.tsx` keeps the shell: capture form, header, groups

No behaviour change in this refactor.

## Testing

API (Vitest, `apps/api`):

- A newly created user has `enableSecondBrain === false`.
- `updateSettings({ enableSecondBrain: true })` persists and is returned by the
  current-user endpoint.
- `settingsSchema` rejects a non-boolean `enableSecondBrain`.

Web has no test setup; verification is manual:

- Preference off → no Second Brain UI in the wiki sidebar.
- Preference on → collapsed header with correct badge counts; expanding shows
  capture form, inbox rows, and review-due rows; the state survives a reload.

## Risks

- **Stale shared build.** Adding a DTO field without rebuilding
  `packages/shared` produces confusing API typecheck errors. Rebuild the package
  before running typecheck.
- **Hydration mismatch.** Reading `localStorage` during render would desync SSR
  markup; the collapsed-first + `useEffect` order avoids this.
