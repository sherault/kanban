# Web Frontend — Auth + API Client + Org/Project Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js 16 web app from scratch — typed API client, cookie-based auth session, and a working multi-tenant shell: login/register, org selection/creation, project list/creation, org settings with invite management, and a public invite accept page.

**Architecture:** Next.js 16 App Router as BFF. All data fetching in React Server Components via a server-side typed `api` client. Mutations via Server Actions (`'use server'`). Session managed in two httpOnly cookies on the web domain: `access_token` (15-min JWT) and `refresh_token` (7-day rotating). The API sets `refresh_token` as a cookie on its own domain (3001) — the web BFF extracts it from the `Set-Cookie` response header and re-stores it on the web domain (3000). Route groups: `(auth)` for public pages, `(app)` for protected pages (guarded by `middleware.ts`). No additional npm dependencies needed.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components + Server Actions (`useFormState` / `useFormStatus`), Tailwind CSS, `@kanban/shared` DTOs

---

## File Map

| Action | File                                                                | Purpose                                                                               |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Modify | `apps/web/tailwind.config.ts`                                       | Add `content` paths (currently missing — Tailwind generates nothing without them)     |
| Modify | `apps/web/src/app/layout.tsx`                                       | Add body base classes                                                                 |
| Modify | `apps/web/src/app/page.tsx`                                         | Redirect root → `/orgs`                                                               |
| Create | `apps/web/src/lib/api.ts`                                           | Server-side typed API client                                                          |
| Create | `apps/web/src/lib/session.ts`                                       | httpOnly cookie read/write (access token, refresh token, display name)                |
| Create | `apps/web/src/middleware.ts`                                        | Auth guard — redirect to `/login` when `access_token` cookie absent                   |
| Create | `apps/web/src/actions/auth.ts`                                      | Server Actions: `loginAction`, `registerAction`, `logoutAction`, `acceptInviteAction` |
| Create | `apps/web/src/actions/orgs.ts`                                      | Server Action: `createOrgAction`                                                      |
| Create | `apps/web/src/actions/projects.ts`                                  | Server Action: `createProjectAction`                                                  |
| Create | `apps/web/src/actions/invitations.ts`                               | Server Action: `createInvitationAction`                                               |
| Create | `apps/web/src/app/(auth)/login/page.tsx`                            | Login form (client component)                                                         |
| Create | `apps/web/src/app/(auth)/register/page.tsx`                         | Register form (client component)                                                      |
| Create | `apps/web/src/app/(app)/layout.tsx`                                 | Authenticated shell layout with nav bar + sign-out                                    |
| Create | `apps/web/src/app/(app)/orgs/page.tsx`                              | Org list (server component)                                                           |
| Create | `apps/web/src/app/(app)/orgs/new/page.tsx`                          | Create org form (client component)                                                    |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/layout.tsx`                    | Breadcrumb layout for org context                                                     |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/page.tsx`                      | Project list (server component)                                                       |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/projects/new/page.tsx`         | Create project form (client component)                                                |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/page.tsx` | Board placeholder (server component)                                                  |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/settings/page.tsx`             | Members list + invite link (server component)                                         |
| Create | `apps/web/src/app/(app)/orgs/[orgId]/settings/InviteSection.tsx`    | Invite link generator (client component)                                              |
| Create | `apps/web/src/app/invite/[token]/page.tsx`                          | Public invite accept page (server component)                                          |
| Create | `apps/web/src/app/invite/[token]/AcceptInviteForm.tsx`              | Invite accept form (client component)                                                 |

---

## API Route Reference

All server-side fetches go to `process.env['API_URL'] ?? 'http://localhost:3001'`. No CORS needed (server-to-server).

| Method | Path                                | Auth required           | Response                                                           |
| ------ | ----------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| POST   | `/auth/register`                    | —                       | `{user: UserDto}` (201)                                            |
| POST   | `/auth/login`                       | —                       | `{user: UserDto, accessToken}` + `Set-Cookie: refresh_token`       |
| POST   | `/auth/refresh`                     | `Cookie: refresh_token` | `{accessToken}` + `Set-Cookie: refresh_token`                      |
| POST   | `/auth/logout`                      | Bearer + Cookie         | `{success: true}`                                                  |
| GET    | `/organizations`                    | Bearer                  | `OrganizationDto[]`                                                |
| POST   | `/organizations`                    | Bearer                  | `OrganizationDto` (201)                                            |
| GET    | `/organizations/:orgId/members`     | Bearer                  | `MembershipDto[]`                                                  |
| POST   | `/organizations/:orgId/invitations` | Bearer                  | `{id, organizationId, expiresAt, createdAt, rawToken}` (201)       |
| GET    | `/organizations/:orgId/projects`    | Bearer                  | `ProjectDto[]`                                                     |
| POST   | `/organizations/:orgId/projects`    | Bearer                  | `ProjectDto` (201)                                                 |
| GET    | `/invite/:token`                    | —                       | `{organization: {id, name}}`                                       |
| POST   | `/invite/:token`                    | —                       | `{user: UserDto, accessToken}` + `Set-Cookie: refresh_token` (201) |

---

## Session Cookie Design

| Cookie          | Value              | MaxAge | httpOnly                    |
| --------------- | ------------------ | ------ | --------------------------- |
| `access_token`  | JWT (Bearer)       | 15 min | ✓                           |
| `refresh_token` | opaque token       | 7 days | ✓                           |
| `user_name`     | displayName string | 7 days | ✗ (used in RSC for display) |

**Refresh token extraction:** The API sets `refresh_token` as an httpOnly cookie on port 3001. When the web BFF calls the API server-side, it receives the `Set-Cookie` header in the response. Extract the value with:

```typescript
const match = setCookieHeader.match(/refresh_token=([^;]+)/);
const refreshToken = match?.[1];
```

Then store it as the web domain's own `refresh_token` cookie. On subsequent refresh calls, pass it manually as `Cookie: refresh_token=<value>` in the request to the API.

---

## Server Action Pattern

All mutations use `useFormState` in client components. The Server Action signature is always:

```typescript
async function someAction(
  _prev: { error?: string }, // previous form state (first arg for useFormState)
  formData: FormData,
): Promise<{ error?: string }>;
```

When a bound argument is needed (e.g. `orgId`), bind before passing to `useFormState`:

```typescript
const action = createProjectAction.bind(null, params.orgId);
const [state, formAction] = useFormState(action, {});
```

`redirect()` in Next.js throws internally and is handled by the framework. Always call it **outside** any try/catch:

```typescript
let result: SomeType
try {
  result = await api.something(...)
} catch (e) {
  return { error: e instanceof ApiError ? e.message : 'Failed' }
}
redirect('/target')  // outside the try — redirect throws are not catchable errors
```

---

## Task 1: Tailwind Fix + API Client + Session Helpers

**Files:**

- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/session.ts`

- [ ] **Step 1: Fix Tailwind content paths**

Without `content`, Tailwind generates zero utility classes. Edit `apps/web/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/actions/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Update root layout**

Edit `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban",
  description: "Multi-tenant Kanban board",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create the API client**

Create `apps/web/src/lib/api.ts`:

```typescript
import type {
  UserDto,
  OrganizationDto,
  MembershipDto,
  InvitationTokenDto,
  ProjectDto,
} from "@kanban/shared";

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
  refreshToken?: string;
}

async function apiFetch<T>(
  path: string,
  { token, refreshToken, ...init }: FetchOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(refreshToken ? { Cookie: `refresh_token=${refreshToken}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(
      res.status,
      (payload as { error?: string }).error ?? "Request failed",
    );
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

export const api = {
  auth: {
    register(body: { email: string; password: string; displayName: string }) {
      return apiFetch<{ user: UserDto }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    login(body: { email: string; password: string }) {
      return apiFetch<{ user: UserDto; accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    refresh(refreshToken: string) {
      return apiFetch<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
        refreshToken,
      });
    },
    logout(token: string, refreshToken: string) {
      return apiFetch<{ success: true }>("/auth/logout", {
        method: "POST",
        token,
        refreshToken,
      });
    },
  },

  orgs: {
    list(token: string) {
      return apiFetch<OrganizationDto[]>("/organizations", { token });
    },
    create(token: string, body: { name: string; website?: string | null }) {
      return apiFetch<OrganizationDto>("/organizations", {
        method: "POST",
        body: JSON.stringify(body),
        token,
      });
    },
    listMembers(token: string, orgId: string) {
      return apiFetch<MembershipDto[]>(`/organizations/${orgId}/members`, {
        token,
      });
    },
    createInvitation(token: string, orgId: string) {
      return apiFetch<InvitationTokenDto & { rawToken: string }>(
        `/organizations/${orgId}/invitations`,
        { method: "POST", token },
      );
    },
  },

  projects: {
    list(token: string, orgId: string) {
      return apiFetch<ProjectDto[]>(`/organizations/${orgId}/projects`, {
        token,
      });
    },
    create(token: string, orgId: string, body: { name: string }) {
      return apiFetch<ProjectDto>(`/organizations/${orgId}/projects`, {
        method: "POST",
        body: JSON.stringify(body),
        token,
      });
    },
  },

  invite: {
    get(rawToken: string) {
      return apiFetch<{ organization: { id: string; name: string } }>(
        `/invite/${rawToken}`,
      );
    },
    accept(
      rawToken: string,
      body: { email: string; password: string; displayName: string },
    ) {
      return apiFetch<{ user: UserDto; accessToken: string }>(
        `/invite/${rawToken}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
  },
};
```

- [ ] **Step 4: Create session helpers**

Create `apps/web/src/lib/session.ts`:

```typescript
import { cookies } from "next/headers";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const USER_NAME_COOKIE = "user_name";

const secure = process.env["NODE_ENV"] === "production";

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}

export function getUserName(): string {
  return cookies().get(USER_NAME_COOKIE)?.value ?? "User";
}

/**
 * Store access token, display name, and optionally the refresh token.
 * The refresh token comes from the API's Set-Cookie header — see extractRefreshToken().
 */
export function setTokens(
  accessToken: string,
  displayName: string,
  refreshToken?: string,
): void {
  cookies().set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 15 * 60,
    path: "/",
  });
  cookies().set(USER_NAME_COOKIE, displayName, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  if (refreshToken) {
    cookies().set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  }
}

export function clearTokens(): void {
  cookies().delete(ACCESS_COOKIE);
  cookies().delete(REFRESH_COOKIE);
  cookies().delete(USER_NAME_COOKIE);
}

/**
 * Parse refresh_token value out of a Set-Cookie header string.
 * Example header: "refresh_token=abc123; HttpOnly; Path=/; Max-Age=604800"
 */
export function extractRefreshToken(
  setCookieHeader: string | null,
): string | undefined {
  if (!setCookieHeader) return undefined;
  const match = setCookieHeader.match(/refresh_token=([^;]+)/);
  return match?.[1] ?? undefined;
}
```

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tailwind.config.ts apps/web/src/app/layout.tsx apps/web/src/lib/api.ts apps/web/src/lib/session.ts
git -c commit.gpgsign=false commit -m "feat: typed API client and session cookie helpers for web BFF"
```

---

## Task 2: Middleware + Auth Server Actions

**Files:**

- Create: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/actions/auth.ts`

- [ ] **Step 1: Create auth guard middleware**

Create `apps/web/src/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Protect all routes under /orgs
  matcher: ["/orgs/:path*"],
};
```

- [ ] **Step 2: Redirect root to /orgs**

Edit `apps/web/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/orgs");
}
```

- [ ] **Step 3: Create auth Server Actions**

Create `apps/web/src/actions/auth.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "../lib/api";
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  extractRefreshToken,
} from "../lib/session";

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  let accessToken: string;
  let displayName: string;
  let refreshToken: string | undefined;

  try {
    const { data, headers } = await api.auth.login({ email, password });
    accessToken = data.accessToken;
    displayName = data.user.displayName;
    refreshToken = extractRefreshToken(headers.get("set-cookie"));
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Login failed" };
  }

  setTokens(accessToken, displayName, refreshToken);
  redirect("/orgs");
}

export async function registerAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  try {
    await api.auth.register({ email, password, displayName });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Registration failed" };
  }

  redirect("/login");
}

export async function logoutAction(): Promise<void> {
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  if (token && refreshToken) {
    await api.auth.logout(token, refreshToken).catch(() => {});
  }
  clearTokens();
  redirect("/login");
}

export async function acceptInviteAction(
  rawToken: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  let accessToken: string;
  let userDisplayName: string;
  let refreshToken: string | undefined;

  try {
    const { data, headers } = await api.invite.accept(rawToken, {
      email,
      password,
      displayName,
    });
    accessToken = data.accessToken;
    userDisplayName = data.user.displayName;
    refreshToken = extractRefreshToken(headers.get("set-cookie"));
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to accept invitation",
    };
  }

  setTokens(accessToken, userDisplayName, refreshToken);
  redirect("/orgs");
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/page.tsx apps/web/src/actions/auth.ts
git -c commit.gpgsign=false commit -m "feat: auth guard middleware and auth server actions (login, register, logout, accept-invite)"
```

---

## Task 3: Login + Register Pages

**Files:**

- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`

Both pages are `'use client'` forms using `useFormState` + `useFormStatus`.

- [ ] **Step 1: Create login page**

Create `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { loginAction } from "../../../actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign in</h1>

          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-blue-600 hover:underline font-medium"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create register page**

Create `apps/web/src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registerAction } from "../../../actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Create account
          </h1>

          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                minLength={1}
                maxLength={100}
                autoComplete="name"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(auth)"
git -c commit.gpgsign=false commit -m "feat: login and register pages"
```

---

## Task 4: App Shell + Org List/Create

**Files:**

- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/actions/orgs.ts`
- Create: `apps/web/src/app/(app)/orgs/page.tsx`
- Create: `apps/web/src/app/(app)/orgs/new/page.tsx`

- [ ] **Step 1: Create the authenticated shell layout**

Create `apps/web/src/app/(app)/layout.tsx`:

```tsx
import Link from "next/link";
import { getUserName } from "../../lib/session";
import { logoutAction } from "../../actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const displayName = getUserName();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create org Server Action**

Create `apps/web/src/actions/orgs.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";

export async function createOrgAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const token = getAccessToken();
  if (!token) redirect("/login");

  const name = formData.get("name") as string;

  let orgId: string;
  try {
    const { data } = await api.orgs.create(token, { name });
    orgId = data.id;
  } catch (e) {
    return {
      error:
        e instanceof ApiError ? e.message : "Failed to create organization",
    };
  }

  redirect(`/orgs/${orgId}`);
}
```

- [ ] **Step 3: Create org list page**

Create `apps/web/src/app/(app)/orgs/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "../../../lib/api";
import { getAccessToken } from "../../../lib/session";

export default async function OrgsPage() {
  const token = getAccessToken();
  if (!token) redirect("/login");

  const { data: orgs } = await api.orgs.list(token);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <Link
          href="/orgs/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No organizations yet</p>
          <p className="text-sm">Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/orgs/${org.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">{org.name}</div>
              {org.website && (
                <div className="text-sm text-gray-400 mt-0.5">
                  {org.website}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create new org page**

Create `apps/web/src/app/(app)/orgs/new/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createOrgAction } from "../../../../actions/orgs";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating…" : "Create organization"}
    </button>
  );
}

export default function NewOrgPage() {
  const [state, formAction] = useFormState(createOrgAction, {});

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <Link
          href="/orgs"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back to organizations
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        New organization
      </h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={1}
              maxLength={100}
              placeholder="Acme Inc."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            <Link
              href="/orgs"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/layout.tsx" apps/web/src/actions/orgs.ts "apps/web/src/app/(app)/orgs"
git -c commit.gpgsign=false commit -m "feat: authenticated app shell, org list and create org pages"
```

---

## Task 5: Org Context + Project List/Create + Board Placeholder

**Files:**

- Create: `apps/web/src/app/(app)/orgs/[orgId]/layout.tsx`
- Create: `apps/web/src/actions/projects.ts`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/page.tsx`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/projects/new/page.tsx`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/page.tsx`

- [ ] **Step 1: Create org breadcrumb layout**

Create `apps/web/src/app/(app)/orgs/[orgId]/layout.tsx`:

```tsx
import Link from "next/link";

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgId: string };
}) {
  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/orgs" className="hover:text-gray-900 transition-colors">
          Organizations
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/orgs/${params.orgId}`}
          className="hover:text-gray-900 transition-colors"
        >
          Projects
        </Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create project Server Action**

Create `apps/web/src/actions/projects.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";

export async function createProjectAction(
  orgId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const token = getAccessToken();
  if (!token) redirect("/login");

  const name = formData.get("name") as string;

  let projectId: string;
  try {
    const { data } = await api.projects.create(token, orgId, { name });
    projectId = data.id;
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create project",
    };
  }

  redirect(`/orgs/${orgId}/projects/${projectId}`);
}
```

- [ ] **Step 3: Create project list page**

Create `apps/web/src/app/(app)/orgs/[orgId]/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "../../../../lib/api";
import { getAccessToken } from "../../../../lib/session";

export default async function OrgPage({
  params,
}: {
  params: { orgId: string };
}) {
  const token = getAccessToken();
  if (!token) redirect("/login");

  const { data: projects } = await api.projects.list(token, params.orgId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Projects</h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/orgs/${params.orgId}/settings`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Settings
          </Link>
          <Link
            href={`/orgs/${params.orgId}/projects/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            New project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">
            Create a project to start organizing your work.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/orgs/${params.orgId}/projects/${p.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(p.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create new project page**

Create `apps/web/src/app/(app)/orgs/[orgId]/projects/new/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createProjectAction } from "../../../../../../actions/projects";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating…" : "Create project"}
    </button>
  );
}

export default function NewProjectPage({
  params,
}: {
  params: { orgId: string };
}) {
  const action = createProjectAction.bind(null, params.orgId);
  const [state, formAction] = useFormState(action, {});

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold text-gray-900 mb-6">New project</h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Project name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={1}
              maxLength={200}
              placeholder="Sprint 1"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            <Link
              href={`/orgs/${params.orgId}`}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create board placeholder page**

This is the landing page when a user clicks a project. Plan 5 will replace its content with the actual board.

Create `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/page.tsx`:

```tsx
import Link from "next/link";

export default function ProjectBoardPage({
  params,
}: {
  params: { orgId: string; projectId: string };
}) {
  return (
    <div className="text-center py-24">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
        <svg
          className="w-8 h-8 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Board coming soon
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        The Kanban board will be built in the next plan.
      </p>
      <Link
        href={`/orgs/${params.orgId}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to projects
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]" apps/web/src/actions/projects.ts
git -c commit.gpgsign=false commit -m "feat: org context layout, project list/create, and board placeholder"
```

---

## Task 6: Org Settings — Members + Invite Link

**Files:**

- Create: `apps/web/src/actions/invitations.ts`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/settings/page.tsx`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/settings/InviteSection.tsx`

- [ ] **Step 1: Create invitation Server Action**

Create `apps/web/src/actions/invitations.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";

export async function createInvitationAction(
  orgId: string,
  _prev: { error?: string; rawToken?: string },
  _formData: FormData,
): Promise<{ error?: string; rawToken?: string }> {
  const token = getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data } = await api.orgs.createInvitation(token, orgId);
    revalidatePath(`/orgs/${orgId}/settings`);
    return { rawToken: data.rawToken };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create invitation",
    };
  }
}
```

- [ ] **Step 2: Create org settings page**

Create `apps/web/src/app/(app)/orgs/[orgId]/settings/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "../../../../../lib/api";
import { getAccessToken } from "../../../../../lib/session";
import { InviteSection } from "./InviteSection";

export default async function OrgSettingsPage({
  params,
}: {
  params: { orgId: string };
}) {
  const token = getAccessToken();
  if (!token) redirect("/login");

  const { data: members } = await api.orgs.listMembers(token, params.orgId);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <Link
          href={`/orgs/${params.orgId}`}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Projects
        </Link>
      </div>

      {/* Members */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Members
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {m.user.displayName}
                </div>
                <div className="text-xs text-gray-400">{m.user.email}</div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      <InviteSection orgId={params.orgId} />
    </div>
  );
}
```

- [ ] **Step 3: Create InviteSection client component**

Create `apps/web/src/app/(app)/orgs/[orgId]/settings/InviteSection.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createInvitationAction } from "../../../../../actions/invitations";

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Generating…" : "Generate invite link"}
    </button>
  );
}

export function InviteSection({ orgId }: { orgId: string }) {
  const action = createInvitationAction.bind(null, orgId);
  const [state, formAction] = useFormState(action, {});

  const inviteUrl =
    state.rawToken && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${state.rawToken}`
      : state.rawToken
        ? `/invite/${state.rawToken}`
        : null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Invite people
      </h3>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gray-500">
          Generate a one-time invite link to share with new members. The link
          expires in 7 days.
        </p>

        <form action={formAction}>
          <GenerateButton />
        </form>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        {inviteUrl && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Share this link:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-700 break-all select-all">
              {inviteUrl}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -8
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/invitations.ts "apps/web/src/app/(app)/orgs/[orgId]/settings"
git -c commit.gpgsign=false commit -m "feat: org settings with member list and invite link generation"
```

---

## Task 7: Public Invite Accept Page

**Files:**

- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Create: `apps/web/src/app/invite/[token]/AcceptInviteForm.tsx`

Note: `acceptInviteAction` was already added to `apps/web/src/actions/auth.ts` in Task 2.

- [ ] **Step 1: Create the invite page (server component)**

Create `apps/web/src/app/invite/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { api } from "../../../lib/api";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  let orgName: string;
  try {
    const { data } = await api.invite.get(params.token);
    orgName = data.organization.name;
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              You&apos;re invited
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Join <span className="font-medium text-gray-700">{orgName}</span>{" "}
              on Kanban
            </p>
          </div>
          <AcceptInviteForm rawToken={params.token} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the accept form (client component)**

Create `apps/web/src/app/invite/[token]/AcceptInviteForm.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { acceptInviteAction } from "../../../actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Joining…" : "Create account & join"}
    </button>
  );
}

export function AcceptInviteForm({ rawToken }: { rawToken: string }) {
  const action = acceptInviteAction.bind(null, rawToken);
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="displayName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={1}
          maxLength={100}
          autoComplete="name"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Verify full build**

```bash
cd apps/web && pnpm build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`. All routes visible in output (login, register, orgs, orgs/new, orgs/[orgId], orgs/[orgId]/settings, orgs/[orgId]/projects/new, orgs/[orgId]/projects/[projectId], invite/[token]).

- [ ] **Step 4: Verify linting**

```bash
cd apps/web && pnpm lint 2>&1 | tail -5
```

Expected: `✓ No ESLint warnings or errors`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/invite
git -c commit.gpgsign=false commit -m "feat: public invite accept page"
```

---

## Self-Review

### Spec coverage

| Feature                                   | Task   |
| ----------------------------------------- | ------ |
| Tailwind content paths (was missing)      | Task 1 |
| Typed API client (`lib/api.ts`)           | Task 1 |
| Session cookie helpers (`lib/session.ts`) | Task 1 |
| Auth guard middleware (`/orgs/:path*`)    | Task 2 |
| Root redirect (`/` → `/orgs`)             | Task 2 |
| `loginAction` server action               | Task 2 |
| `registerAction` server action            | Task 2 |
| `logoutAction` server action              | Task 2 |
| `acceptInviteAction` server action        | Task 2 |
| Login page with error display             | Task 3 |
| Register page with error display          | Task 3 |
| App shell nav with sign-out               | Task 4 |
| Org list page                             | Task 4 |
| Create org page + action                  | Task 4 |
| Org breadcrumb layout                     | Task 5 |
| Project list page                         | Task 5 |
| Create project page + action              | Task 5 |
| Board placeholder page                    | Task 5 |
| Org settings — members list               | Task 6 |
| Org settings — invite link generator      | Task 6 |
| Public invite accept page                 | Task 7 |
| Accept form registers user + joins org    | Task 7 |

### Placeholder scan

No TBDs, no vague steps. All code is complete and self-contained per task.

### Type consistency

- `loginAction(_prev, formData) → Promise<{error?}>` — matches `useFormState(loginAction, {})` in login page ✓
- `registerAction(_prev, formData) → Promise<{error?}>` — matches register page ✓
- `logoutAction() → void` — called via `<form action={logoutAction}>` in layout ✓
- `acceptInviteAction(rawToken, _prev, formData)` — bound as `acceptInviteAction.bind(null, rawToken)` in AcceptInviteForm ✓
- `createOrgAction(_prev, formData)` — matches `useFormState(createOrgAction, {})` in new-org page ✓
- `createProjectAction(orgId, _prev, formData)` — bound as `createProjectAction.bind(null, params.orgId)` in new-project page ✓
- `createInvitationAction(orgId, _prev, formData) → Promise<{error?, rawToken?}>` — bound as `createInvitationAction.bind(null, orgId)` in InviteSection; state has `rawToken` field ✓
- `api.orgs.createInvitation(token, orgId)` returns `InvitationTokenDto & { rawToken: string }` — InviteSection reads `data.rawToken` ✓
- `api.invite.get(rawToken)` returns `{organization: {id, name}}` — InvitePage reads `data.organization.name` ✓
- `extractRefreshToken(headers.get('set-cookie'))` returns `string | undefined` — matches third arg of `setTokens(accessToken, displayName, refreshToken?)` ✓
