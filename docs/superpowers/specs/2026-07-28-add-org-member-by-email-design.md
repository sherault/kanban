# Add an organization member by email

## Problem

Organization settings only supports adding people through a one-time invite
link. There is no way to add a user who already has an account. A manager who
knows a colleague's email must still generate a link and pass it out of band.

## Goal

In `Settings > Invites`, below the "Generate invite link" block, add an email
autocomplete field. Typing at least 3 characters lists matching users who are
not already in the organization. Clicking a result adds that user to the
organization immediately as a `member` — no invitation record, no email, no
acceptance step. The `Settings > Members` list reflects the addition.

## Search scope

Search is restricted twice over:

1. **Authorization** — only `owner` and `manager` of the target organization may
   search or add.
2. **Co-visibility** — results are limited to users who share at least one
   organization with the actor. A manager cannot enumerate the whole user base.

The actor's own organizations include the target organization, so its existing
members would match the co-visibility join; they are removed by the explicit
"already a member" exclusion.

## API (`apps/api`)

### `organization-service/member-search.ts` (new)

```ts
searchMemberCandidates(
  ctx: OrganizationServiceContext,
  orgId: string,
  actorId: string,
  query: string,
): MemberCandidateDto[]
```

- Lowercase the query, match with `LIKE %q%` against `users.email`.
- Join `memberships` to the set of organizations the actor belongs to
  (co-visibility).
- Exclude users who already hold a membership in `orgId`.
- `DISTINCT`, ordered by `users.email`, `LIMIT 10`.

### `organization-service/members.ts`

```ts
addOrganizationMember(
  ctx: OrganizationServiceContext,
  orgId: string,
  actorId: string,
  userId: string,
): MembershipDto
```

- User does not exist → `notFound("User not found")`.
- User already a member → `unprocessable("User is already a member")`.
- User is not co-visible to the actor → `forbidden()`. This check is repeated
  here on purpose: without it a manager could bypass the search constraint by
  POSTing an arbitrary `userId`.
- Insert the membership with `role: "member"`.
- Broadcast on `org:${orgId}` with `type: "member.added"` and the new
  `MembershipDto` as payload.

### Routes (`organization.routes.ts`)

Both guarded by `authz.requireOrgRole("manager", ...)`:

- `GET /:orgId/member-candidates?q=<query>` — zod query schema, `q` between 3
  and 320 characters (320 is the RFC 5321 maximum email length). Returns
  `MemberCandidateDto[]`.
- `POST /:orgId/members` — zod body `{ userId: string().uuid() }`. Returns the
  new `MembershipDto` with status 201.

### Shared (`packages/shared`)

In `dtos/organization.ts`:

```ts
export type MemberCandidateDto = Pick<UserDto, "id" | "displayName" | "email">;
```

## Web (`apps/web`)

### `lib/api/orgs.ts`

- `searchMemberCandidates(token, orgId, q)` → `MemberCandidateDto[]`
- `addMember(token, orgId, userId)` → `MembershipDto`

### `actions/orgs.ts`

- `searchMemberCandidatesAction(orgId, q)` → `{ candidates }` or `{ error }`
- `addMemberAction(orgId, userId)` → `{}` or `{ error }`, revalidates
  `/orgs/${orgId}/settings`

### `components/org/AddMemberField.tsx` (new)

Client component. Owns the query string, the result list, and the pending
state.

- Debounces input by 250 ms; issues no request below 3 characters.
- Drops responses that arrive out of order (keep only the latest query's
  results).
- Renders a dropdown of results showing display name and email; an empty result
  set shows "No matching users".
- Keyboard: arrow up/down to move the highlight, Enter to add the highlighted
  user, Escape to close the dropdown.
- Clicking or Entering a result calls `addMemberAction`, then clears the field
  and calls `onMemberAdded()`.
- Errors render inline under the field.

### `components/org/InviteSection.tsx`

Accepts a new `onMemberAdded: () => void` prop and renders `AddMemberField`
below the existing "Generate invite link" block, under its own heading.

### `components/OrgSettingsModal.tsx`

The organization data loader currently lives inline in a `useEffect`. Extract it
into a `refreshData()` callback used both by that effect and by
`InviteSection`'s `onMemberAdded`, so the Members tab shows the new member.

## Testing

Vitest integration tests in `apps/api`, against `createTestDb()`.

Search:

- A query under 3 characters is rejected by the route.
- Partial email matches are returned.
- Existing members of the target organization are excluded.
- Users who share no organization with the actor are excluded.
- At most 10 results are returned.
- A plain `member` of the organization gets 403.

Add:

- A co-visible non-member is added with role `member` and appears in
  `listMembers`.
- Adding an existing member fails with 422.
- Adding a non-co-visible user fails with 403.
- Adding an unknown user id fails with 404.
- A plain `member` of the organization gets 403.

## Out of scope

- Notifying the added user by email or in-app message.
- Choosing a role other than `member` at add time — the existing role selector
  in the Members list covers that afterwards.
- Searching by display name.
