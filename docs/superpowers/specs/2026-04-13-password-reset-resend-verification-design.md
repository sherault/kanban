# Password Reset & Unauthenticated Resend Verification

**Date:** 2026-04-13  
**Status:** Approved

## Problem

Two auth recovery flows are missing for unauthenticated users:

1. **Reset password** — no forgot-password flow exists at all.
2. **Resend verification link** — the existing `/identity/resend-verification` endpoint requires authentication, making it unreachable for users whose verification link expired before they could log in.

## Approach

Two separate flows, mirroring the pattern already in place for `emailVerifications`. Each has its own DB table (for password reset), service methods, API routes, and web pages.

---

## Database

### New table: `passwordResets`

```sql
CREATE TABLE password_resets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashed_token TEXT NOT NULL UNIQUE,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- Token TTL: **1 hour** (vs 24h for email verifications)
- One-time use: deleted immediately after the password is changed
- One pending reset per user: old token replaced on re-request
- No changes to existing tables

---

## API (`apps/api`)

### New public routes (no auth required)

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/identity/forgot-password` | `{ email: string }` | Request a password reset link |
| `POST` | `/identity/reset-password` | `{ token: string, password: string }` | Set new password using reset token |
| `POST` | `/identity/resend-verification-public` | `{ email: string }` | Resend email verification link (unauthenticated) |

Existing authenticated `POST /identity/resend-verification` remains unchanged.

### New service methods (`IdentityService`)

**`requestPasswordReset(email: string): Promise<void>`**
- Looks up user by email; silently does nothing if not found (prevents email enumeration)
- Deletes any existing pending reset token for the user
- Generates a new token, hashes it, inserts into `passwordResets` with 1-hour expiry
- Sends password reset email (fire-and-forget, logs on failure)
- Always returns success

**`resetPassword(rawToken: string, newPassword: string): Promise<void>`**
- Hashes token, looks up in `passwordResets`
- Throws `unauthorized` if not found or expired (deletes expired record)
- Hashes new password, updates `users.passwordHash`
- Deletes all `refreshTokens` for the user (invalidates all sessions)
- Deletes the used reset token

**`resendVerificationByEmail(email: string): Promise<void>`**
- Looks up user by email; silently returns if not found or already verified (prevents enumeration)
- Delegates to existing `resendVerification(userId)` logic
- Always returns success

### New mailer functions (`apps/api/src/lib/mailer.ts`)

**`sendPasswordResetEmail(to: string, token: string): Promise<void>`**
- Same pattern as `sendVerificationEmail`
- URL: `${APP_URL}/reset-password?token=${token}`
- Subject: "Reset your password"
- Token expires in 1 hour (noted in email body)

Resend verification reuses the existing `sendVerificationEmail`.

---

## Web (`apps/web`)

### New pages

| Route | Description |
|-------|-------------|
| `/forgot-password` | Email input form. On submit → always redirects to `/forgot-password/check-email` (no error leak) |
| `/forgot-password/check-email` | Static "check your email" page, mirrors `/register/check-email` |
| `/reset-password` | Reads `?token=` from URL query. New password input form. On success → redirects to `/login?reset=success`. Shows error inline on invalid/expired token. |

### Login page changes (`/login`)

- Add "Forgot password?" link below the Sign in button, pointing to `/forgot-password`
- If `?reset=success` is present in the URL, display a green success banner: "Password updated — please sign in"
- Only shown on the email/password step (not on the TOTP step)

### New server actions (`apps/web/src/actions/auth.ts`)

**`forgotPasswordAction(_prev, formData)`**
- Calls `POST /identity/forgot-password`
- Always redirects to `/forgot-password/check-email` regardless of outcome

**`resetPasswordAction(_prev, formData)`**
- Reads `token` from hidden form field, `password` from input
- Calls `POST /identity/reset-password`
- On success: redirects to `/login?reset=success`
- On error: returns `{ error: string }` for inline display

**`resendVerificationPublicAction(_prev, formData)`**
- Calls `POST /identity/resend-verification-public`
- Always redirects to `/register/check-email` (reuses existing static page)

---

## Security

- **No email enumeration:** All public endpoints always return success regardless of whether the email exists.
- **Session invalidation:** All refresh tokens for the user are deleted on password reset.
- **One-time tokens:** Reset tokens are deleted immediately after use.
- **Short expiry:** Reset tokens expire in 1 hour.
- **Token hashing:** Tokens stored as SHA-256 hashes (matching existing `hashToken` utility), raw token only in the email link.

---

## Out of scope

- Rate limiting on reset/resend endpoints (existing API has none)
- Email notification to user when their password is changed
- Admin tooling to view pending resets
