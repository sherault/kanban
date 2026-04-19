# Password Reset & Unauthenticated Resend Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add forgot-password and unauthenticated-resend-verification flows so users can recover access from the login page.

**Architecture:** New `passwordResets` DB table + `IdentityService` methods + 3 public API routes, then 3 web pages, 3 server actions, and login page UX changes. Follows patterns already established by `emailVerifications`.

**Tech Stack:** Drizzle ORM + better-sqlite3 (API), Hono routes, Next.js 16 App Router server actions + client components (Web), Nodemailer (mailer), Vitest (tests).

---

## File Map

**Create:**

- `apps/api/drizzle/migrations/0003_password_resets.sql` — migration for new table
- `apps/web/src/app/(auth)/forgot-password/page.tsx` — email input form
- `apps/web/src/app/(auth)/forgot-password/check-email/page.tsx` — static confirmation page
- `apps/web/src/app/(auth)/reset-password/page.tsx` — server component, reads `?token=` from URL
- `apps/web/src/app/(auth)/reset-password/ResetPasswordForm.tsx` — client form component

**Modify:**

- `apps/api/src/db/schema/identity.ts` — add `passwordResets` table definition
- `apps/api/src/lib/mailer.ts` — add `sendPasswordResetEmail`
- `apps/api/src/features/identity/identity.service.ts` — add 3 new service methods
- `apps/api/src/features/identity/identity.routes.ts` — add 3 new public routes
- `apps/api/src/tests/features/identity.service.test.ts` — tests for new service methods
- `apps/api/src/tests/features/identity.test.ts` — HTTP tests for new routes
- `apps/web/src/lib/api.ts` — add 3 new API client methods
- `apps/web/src/actions/auth.ts` — add 3 new server actions
- `apps/web/src/app/(auth)/login/page.tsx` — add "Forgot password?" link + success banner

---

## Task 1: DB schema + migration

**Files:**

- Modify: `apps/api/src/db/schema/identity.ts`
- Create: `apps/api/drizzle/migrations/0003_password_resets.sql`

- [ ] **Step 1: Add `passwordResets` table to the schema**

  Open `apps/api/src/db/schema/identity.ts` and append after the `emailVerifications` table:

  ```ts
  export const passwordResets = sqliteTable("password_resets", {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hashedToken: text("hashed_token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  });
  ```

- [ ] **Step 2: Generate the migration**

  ```bash
  cd apps/api && pnpm drizzle-kit generate
  ```

  Expected: a new file `apps/api/drizzle/migrations/0003_<something>.sql` is created containing `CREATE TABLE \`password_resets\``.

  Rename it to `0003_password_resets.sql` for clarity (optional but keeps naming consistent with the rest):

  ```bash
  mv apps/api/drizzle/migrations/0003_*.sql apps/api/drizzle/migrations/0003_password_resets.sql
  ```

  Then update `apps/api/drizzle/migrations/meta/_journal.json` — change the `"tag"` for entry `idx: 3` to `"0003_password_resets"`.

- [ ] **Step 3: Run tests to confirm migration loads cleanly**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all existing tests pass (the in-memory test DB now includes the new table).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/db/schema/identity.ts apps/api/drizzle/
  git commit -m "feat: add passwordResets table and migration"
  ```

---

## Task 2: Mailer — `sendPasswordResetEmail`

**Files:**

- Modify: `apps/api/src/lib/mailer.ts`

- [ ] **Step 1: Add the function**

  Append to `apps/api/src/lib/mailer.ts`:

  ```ts
  export async function sendPasswordResetEmail(
    to: string,
    token: string,
  ): Promise<void> {
    const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
    const url = `${appUrl}/reset-password?token=${token}`;
    const transport = createTransport();

    if (!transport) {
      console.log(`[mailer] Password reset email for ${to}:\n  ${url}`);
      return;
    }

    await transport.sendMail({
      from: process.env["SMTP_FROM"] ?? "noreply@kanban.local",
      to,
      subject: "Reset your password",
      text: `Reset your password by visiting: ${url}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email.`,
      html: `
        <p>Someone requested a password reset for your account.</p>
        <p><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
        <p style="color:#6b7280;font-size:12px;">Or copy this link: ${url}<br>This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
      `,
    });
  }
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass (no import errors).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/api/src/lib/mailer.ts
  git commit -m "feat: add sendPasswordResetEmail mailer function"
  ```

---

## Task 3: IdentityService — new methods (tests first)

**Files:**

- Modify: `apps/api/src/tests/features/identity.service.test.ts`
- Modify: `apps/api/src/features/identity/identity.service.ts`

- [ ] **Step 1: Write the failing tests**

  First, update the imports at the top of `apps/api/src/tests/features/identity.service.test.ts` to add:

  ```ts
  import { eq } from "drizzle-orm";
  import { generateToken, hashToken } from "../../lib/token.js";
  import { generateId } from "../../lib/id.js";
  import { passwordResets, users } from "../../db/schema/index.js";
  ```

  Then append the new test suites:

  ```ts
  describe("IdentityService.requestPasswordReset", () => {
    it("succeeds silently for unknown email (no enumeration)", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await expect(
        svc.requestPasswordReset("nobody@example.com"),
      ).resolves.toBeUndefined();
      close();
    });

    it("succeeds for known email", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await createVerifiedUser(db, {
        email: "eve@example.com",
        password: "pw",
        displayName: "Eve",
      });
      await expect(
        svc.requestPasswordReset("eve@example.com"),
      ).resolves.toBeUndefined();
      close();
    });

    it("replaces an existing reset token on re-request", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await createVerifiedUser(db, {
        email: "eve@example.com",
        password: "pw",
        displayName: "Eve",
      });
      await svc.requestPasswordReset("eve@example.com");
      await svc.requestPasswordReset("eve@example.com");
      await expect(
        svc.requestPasswordReset("eve@example.com"),
      ).resolves.toBeUndefined();
      close();
    });
  });

  // Helper: insert a valid reset token directly into the DB for a given user email
  async function insertResetToken(
    db: ReturnType<typeof createTestDb>["db"],
    email: string,
  ): Promise<string> {
    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);
    const user = db.select().from(users).where(eq(users.email, email)).get()!;
    const future = new Date();
    future.setHours(future.getHours() + 1);
    db.insert(passwordResets)
      .values({
        id: generateId(),
        userId: user.id,
        hashedToken,
        expiresAt: future.toISOString(),
      })
      .run();
    return rawToken;
  }

  describe("IdentityService.resetPassword", () => {
    it("changes the password and allows login with new password", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await createVerifiedUser(db, {
        email: "frank@example.com",
        password: "oldpass",
        displayName: "Frank",
      });
      const rawToken = await insertResetToken(db, "frank@example.com");
      await svc.resetPassword(rawToken, "newpass123");
      const result = await svc.login({
        email: "frank@example.com",
        password: "newpass123",
      });
      expect(typeof result.accessToken).toBe("string");
      close();
    });

    it("throws 401 for invalid token", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await expect(
        svc.resetPassword("bad-token", "newpass123"),
      ).rejects.toMatchObject({ status: 401 });
      close();
    });

    it("invalidates all sessions on successful reset", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await createVerifiedUser(db, {
        email: "grace@example.com",
        password: "oldpass",
        displayName: "Grace",
      });
      const { refreshToken } = await svc.login({
        email: "grace@example.com",
        password: "oldpass",
      });
      const rawToken = await insertResetToken(db, "grace@example.com");
      await svc.resetPassword(rawToken, "newpass123");
      await expect(svc.refresh(refreshToken)).rejects.toMatchObject({
        status: 401,
      });
      close();
    });
  });

  describe("IdentityService.resendVerificationByEmail", () => {
    it("succeeds silently for unknown email", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await expect(
        svc.resendVerificationByEmail("nobody@example.com"),
      ).resolves.toBeUndefined();
      close();
    });

    it("succeeds silently for already-verified email", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await createVerifiedUser(db, {
        email: "hank@example.com",
        password: "pw",
        displayName: "Hank",
      });
      await expect(
        svc.resendVerificationByEmail("hank@example.com"),
      ).resolves.toBeUndefined();
      close();
    });

    it("sends a new token for an unverified email", async () => {
      const { db, close } = createTestDb();
      const svc = new IdentityService(db);
      await svc.register({
        email: "ivy@example.com",
        password: "pw12345678",
        displayName: "Ivy",
      });
      await expect(
        svc.resendVerificationByEmail("ivy@example.com"),
      ).resolves.toBeUndefined();
      close();
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd apps/api && pnpm test -- identity.service
  ```

  Expected: new tests FAIL with "svc.requestPasswordReset is not a function" (or similar).

- [ ] **Step 3: Implement the three methods**

  In `apps/api/src/features/identity/identity.service.ts`:

  a. Add import at the top alongside existing imports:

  ```ts
  import { sendPasswordResetEmail } from "../../lib/mailer.js";
  import { passwordResets } from "../../db/schema/index.js";
  ```

  b. Add constant alongside existing TTL constants:

  ```ts
  const RESET_TTL_HOURS = 1;
  ```

  c. Add three methods inside the `IdentityService` class, after `resendVerification`:

  ```ts
  async requestPasswordReset(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user) return

    this.db.delete(passwordResets).where(eq(passwordResets.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(passwordResets)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(RESET_TTL_HOURS) })
      .run()
    void sendPasswordResetEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to send password reset email:', err)
    })
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(rawToken)
    const record = this.db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.hashedToken, hashedToken))
      .get()
    if (!record) throw unauthorized('Invalid or expired reset link')
    if (new Date(record.expiresAt) < new Date()) {
      this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
      throw unauthorized('Reset link has expired')
    }
    const passwordHash = await hashPassword(newPassword)
    this.db.update(users).set({ passwordHash }).where(eq(users.id, record.userId)).run()
    this.db.delete(refreshTokens).where(eq(refreshTokens.userId, record.userId)).run()
    this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
  }

  async resendVerificationByEmail(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user || user.emailVerified) return

    this.db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(emailVerifications)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(VERIFY_TTL_HOURS) })
      .run()
    void sendVerificationEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to resend verification email:', err)
    })
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm test -- identity.service
  ```

  Expected: all tests in identity.service.test.ts PASS.

- [ ] **Step 5: Run the full suite**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/features/identity/identity.service.ts \
          apps/api/src/tests/features/identity.service.test.ts
  git commit -m "feat: add requestPasswordReset, resetPassword, resendVerificationByEmail to IdentityService"
  ```

---

## Task 4: API routes — 3 new public endpoints (tests first)

**Files:**

- Modify: `apps/api/src/tests/features/identity.test.ts`
- Modify: `apps/api/src/features/identity/identity.routes.ts`

- [ ] **Step 1: Write the failing HTTP tests**

  Append to `apps/api/src/tests/features/identity.test.ts`:

  ```ts
  describe("POST /auth/forgot-password", () => {
    it("returns 200 for any email (no enumeration)", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "anyone@example.com" }),
      });
      expect(res.status).toBe(200);
      close();
    });

    it("returns 400 for invalid email", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });
      expect(res.status).toBe(400);
      close();
    });
  });

  describe("POST /auth/reset-password", () => {
    it("returns 401 for invalid token", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "bad-token", password: "newpass123" }),
      });
      expect(res.status).toBe(401);
      close();
    });

    it("returns 400 for missing fields", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "tok" }),
      });
      expect(res.status).toBe(400);
      close();
    });
  });

  describe("POST /auth/resend-verification-public", () => {
    it("returns 200 for any email (no enumeration)", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/resend-verification-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "anyone@example.com" }),
      });
      expect(res.status).toBe(200);
      close();
    });

    it("returns 400 for invalid email", async () => {
      const { app, close } = setup();
      const res = await app.request("/auth/resend-verification-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bad" }),
      });
      expect(res.status).toBe(400);
      close();
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd apps/api && pnpm test -- identity.test
  ```

  Expected: new tests FAIL with 404 (routes don't exist yet).

- [ ] **Step 3: Add the three routes**

  In `apps/api/src/features/identity/identity.routes.ts`, add these schemas near the other schema definitions at the top of `identityRoutes`:

  ```ts
  const emailSchema = z.object({ email: z.string().email() });
  const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  });
  ```

  Then add these three routes in the `// ── Public ──` section, before the `// ── Authenticated ──` section:

  ```ts
  router.post(
    "/forgot-password",
    zValidator("json", emailSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      await svc.requestPasswordReset(email);
      return c.json({ success: true });
    },
  );

  router.post(
    "/reset-password",
    zValidator("json", resetPasswordSchema),
    async (c) => {
      const { token, password } = c.req.valid("json");
      await svc.resetPassword(token, password);
      return c.json({ success: true });
    },
  );

  router.post(
    "/resend-verification-public",
    zValidator("json", emailSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      await svc.resendVerificationByEmail(email);
      return c.json({ success: true });
    },
  );
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm test -- identity.test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Run the full suite**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/features/identity/identity.routes.ts \
          apps/api/src/tests/features/identity.test.ts
  git commit -m "feat: add forgot-password, reset-password, resend-verification-public routes"
  ```

---

## Task 5: Web API client — 3 new methods

**Files:**

- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add 3 methods to the `auth` namespace**

  In `apps/web/src/lib/api.ts`, inside `api.auth`, add after `resendVerification`:

  ```ts
  forgotPassword(body: { email: string }) {
    return apiFetch<{ success: true }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  resetPassword(body: { token: string; password: string }) {
    return apiFetch<{ success: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  resendVerificationPublic(body: { email: string }) {
    return apiFetch<{ success: true }>('/auth/resend-verification-public', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/lib/api.ts
  git commit -m "feat: add forgotPassword, resetPassword, resendVerificationPublic to web API client"
  ```

---

## Task 6: Web server actions — 3 new actions

**Files:**

- Modify: `apps/web/src/actions/auth.ts`

- [ ] **Step 1: Add the three actions**

  Append to `apps/web/src/actions/auth.ts`:

  ```ts
  export async function forgotPasswordAction(
    _prev: Record<string, never>,
    formData: FormData,
  ): Promise<Record<string, never>> {
    const email = formData.get("email") as string;
    await api.auth.forgotPassword({ email }).catch(() => {});
    redirect("/forgot-password/check-email");
  }

  export async function resetPasswordAction(
    _prev: { error?: string },
    formData: FormData,
  ): Promise<{ error?: string }> {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    try {
      await api.auth.resetPassword({ token, password });
    } catch (e) {
      return { error: e instanceof ApiError ? e.message : "Reset failed" };
    }
    redirect("/login?reset=success");
  }

  export async function resendVerificationPublicAction(
    _prev: Record<string, never>,
    formData: FormData,
  ): Promise<Record<string, never>> {
    const email = formData.get("email") as string;
    await api.auth.resendVerificationPublic({ email }).catch(() => {});
    redirect("/register/check-email");
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/actions/auth.ts
  git commit -m "feat: add forgotPassword, resetPassword, resendVerificationPublic server actions"
  ```

---

## Task 7: Web — forgot-password pages

**Files:**

- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/app/(auth)/forgot-password/check-email/page.tsx`

- [ ] **Step 1: Create the forgot-password form page**

  Create `apps/web/src/app/(auth)/forgot-password/page.tsx`:

  ```tsx
  "use client";

  import { useActionState } from "react";
  import { useFormStatus } from "react-dom";
  import Link from "next/link";
  import { forgotPasswordAction } from "../../../../actions/auth";

  function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    );
  }

  export default function ForgotPasswordPage() {
    const [, formAction] = useActionState(forgotPasswordAction, {});

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Forgot password?
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form action={formAction} className="space-y-4">
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
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <SubmitButton />
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              <Link
                href="/login"
                className="text-blue-600 hover:underline font-medium"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create the check-email confirmation page**

  Create `apps/web/src/app/(auth)/forgot-password/check-email/page.tsx`:

  ```tsx
  import Link from "next/link";

  export default function ForgotPasswordCheckEmailPage() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
            <div className="text-4xl">📬</div>
            <h1 className="text-xl font-bold text-gray-900">
              Check your email
            </h1>
            <p className="text-sm text-gray-600">
              If that email is registered, we sent a password reset link. Click
              the link to set a new password.
            </p>
            <p className="text-xs text-gray-400">
              The link expires in 1 hour. Check your spam folder if you
              don&apos;t see it.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-blue-600 hover:underline font-medium"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(auth\)/forgot-password/
  git commit -m "feat: add forgot-password page and check-email confirmation page"
  ```

---

## Task 8: Web — reset-password page

**Files:**

- Create: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Create: `apps/web/src/app/(auth)/reset-password/ResetPasswordForm.tsx`

- [ ] **Step 1: Create the client form component**

  Create `apps/web/src/app/(auth)/reset-password/ResetPasswordForm.tsx`:

  ```tsx
  "use client";

  import { useActionState } from "react";
  import { useFormStatus } from "react-dom";
  import Link from "next/link";
  import { resetPasswordAction } from "../../../../actions/auth";

  function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    );
  }

  export function ResetPasswordForm({ token }: { token: string }) {
    const [state, formAction] = useActionState(resetPasswordAction, {});

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Set new password
            </h1>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="token" value={token} />

              {state.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                  {state.error}{" "}
                  <Link
                    href="/forgot-password"
                    className="underline font-medium"
                  >
                    Request a new link
                  </Link>
                </div>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <SubmitButton />
            </form>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create the server component page**

  Create `apps/web/src/app/(auth)/reset-password/page.tsx`:

  ```tsx
  import Link from "next/link";
  import { ResetPasswordForm } from "./ResetPasswordForm";

  export default async function ResetPasswordPage({
    searchParams,
  }: {
    searchParams: Promise<{ token?: string }>;
  }) {
    const { token } = await searchParams;

    if (!token) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
              <div className="text-4xl">❌</div>
              <h1 className="text-xl font-bold text-gray-900">
                Invalid reset link
              </h1>
              <p className="text-sm text-gray-600">
                This link is missing a token. Please request a new reset link.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block text-sm text-blue-600 hover:underline font-medium"
              >
                Request new link
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return <ResetPasswordForm token={token} />;
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(auth\)/reset-password/
  git commit -m "feat: add reset-password page"
  ```

---

## Task 9: Login page — "Forgot password?" link + success banner

**Files:**

- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Add Suspense import and ResetSuccessBanner component**

  In `apps/web/src/app/(auth)/login/page.tsx`:

  a. Add `Suspense` to the React import and import `useSearchParams`:

  ```tsx
  import { useActionState, Suspense } from "react";
  import { useFormStatus } from "react-dom";
  import { useSearchParams } from "next/navigation";
  import Link from "next/link";
  import { loginAction } from "../../../actions/auth";
  ```

  b. Add the banner component (add before `LoginPage`):

  ```tsx
  function ResetSuccessBanner() {
    const params = useSearchParams();
    if (params.get("reset") !== "success") return null;
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">
        Password updated — please sign in with your new password.
      </div>
    );
  }
  ```

- [ ] **Step 2: Add the banner and "Forgot password?" link to the JSX**

  Inside `LoginPage`, in the email/password form branch (the `else` block, i.e. `!showTotp`):

  a. Add the banner at the top of the form, before the existing `state.error` block:

  ```tsx
  <Suspense fallback={null}>
    <ResetSuccessBanner />
  </Suspense>
  ```

  b. Add the "Forgot password?" link. Replace the `<SubmitButton label="Sign in" />` block with:

  ```tsx
  <SubmitButton label="Sign in" />
  <p className="text-center text-sm">
    <Link href="/forgot-password" className="text-gray-500 hover:text-gray-700 hover:underline text-xs">
      Forgot password?
    </Link>
  </p>
  ```

  The complete form for the non-TOTP branch should now have:
  - Suspense/ResetSuccessBanner
  - state.error block
  - email field
  - password field
  - Sign in button
  - Forgot password? link

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(auth\)/login/page.tsx
  git commit -m "feat: add forgot-password link and reset-success banner to login page"
  ```

---

## Task 10: End-to-end smoke test

- [ ] **Step 1: Run the full API test suite one final time**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 2: Start the dev server and manually verify the flows**

  ```bash
  pnpm dev
  ```

  **Flow A — Forgot password:**
  1. Go to `http://localhost:3000/login` — verify "Forgot password?" link is visible below Sign in button
  2. Click "Forgot password?" — lands on `/forgot-password`
  3. Submit any email (including non-existent) — redirects to `/forgot-password/check-email`
  4. Console should log the reset link (SMTP not configured in dev): `[mailer] Password reset email for ...: http://localhost:3000/reset-password?token=...`
  5. Copy the token from console, navigate to `/reset-password?token=<token>`
  6. Enter a new password (min 8 chars), submit — redirects to `/login?reset=success`
  7. Verify green success banner appears on the login page
  8. Log in with the new password — succeeds

  **Flow B — Resend verification (if applicable):**
  1. Register a new account: `http://localhost:3000/register`
  2. Try to log in — gets "Please verify your email" error (403)
  3. Navigate to `/forgot-password` (or wherever resend verification is exposed — see note below)

  > **Note:** The `resendVerificationPublicAction` and its page (`/resend-verification-public`) are wired up in the actions but no dedicated page was created in this plan. If you want to expose it, create a simple page similar to `/forgot-password` that submits an email to `resendVerificationPublicAction`. Alternatively, wire it to the login page's 403 error state (show "Resend verification email" link when the error is the email-not-verified message). This is left as a follow-up UI decision.

- [ ] **Step 3: Final commit if any polish was needed**

  ```bash
  git add -p
  git commit -m "fix: polish from smoke test"
  ```
