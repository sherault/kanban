import { eq } from "drizzle-orm";
import { authenticator } from "../../../lib/otp.js";
import { refreshTokens, users } from "../../../db/schema/index.js";
import { forbidden, unauthorized } from "../../../lib/errors.js";
import { generateId } from "../../../lib/id.js";
import { signAccessToken } from "../../../lib/jwt.js";
import { verifyPassword } from "../../../lib/password.js";
import { generateToken, hashToken } from "../../../lib/token.js";
import {
  expiresAt,
  expiresAtMinutes,
  expiresAtSeconds,
  IdentityBase,
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_ATTEMPTS,
  REFRESH_TTL_DAYS,
} from "./base.js";
import { TotpRequiredError } from "./totp-required-error.js";
import type { LoginInput, LoginResult, RefreshResult } from "./types.js";

export class IdentitySessionOperations extends IdentityBase {
  async login(input: LoginInput): Promise<LoginResult> {
    const user = this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .get();
    if (!user) throw unauthorized("Invalid credentials");
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      throw forbidden(
        `Account is locked. Please try again after ${new Date(user.lockoutUntil).toLocaleTimeString()}`,
      );
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      this.recordFailedLogin(user);
    }
    if (!user.emailVerified) {
      throw forbidden("Please verify your email before signing in");
    }
    if (user.totpEnabled && user.totpSecret) {
      if (!input.totpCode) throw new TotpRequiredError();
      if (
        !authenticator.verify({
          token: input.totpCode,
          secret: user.totpSecret,
        })
      ) {
        throw unauthorized("Invalid authenticator code");
      }
    }
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      this.db
        .update(users)
        .set({ failedLoginAttempts: 0, lockoutUntil: null })
        .where(eq(users.id, user.id))
        .run();
    }

    const sessionId = generateId();
    const rawToken = generateToken();
    this.db
      .insert(refreshTokens)
      .values({
        id: sessionId,
        userId: user.id,
        hashedToken: hashToken(rawToken),
        expiresAt: expiresAt(REFRESH_TTL_DAYS),
      })
      .run();
    const accessToken = await signAccessToken({ sub: user.id, sessionId });
    return { user: this.toUserDto(user), accessToken, refreshToken: rawToken };
  }

  async refresh(rawToken: string): Promise<RefreshResult> {
    const record = this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.hashedToken, hashToken(rawToken)))
      .get();
    if (!record) throw unauthorized("Invalid refresh token");
    if (new Date(record.expiresAt) < new Date()) {
      this.db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, record.id))
        .run();
      throw unauthorized("Refresh token expired");
    }

    this.db
      .update(refreshTokens)
      .set({ expiresAt: expiresAtSeconds(10) })
      .where(eq(refreshTokens.id, record.id))
      .run();
    const newSessionId = generateId();
    const newRawToken = generateToken();
    this.db
      .insert(refreshTokens)
      .values({
        id: newSessionId,
        userId: record.userId,
        hashedToken: hashToken(newRawToken),
        expiresAt: expiresAt(REFRESH_TTL_DAYS),
      })
      .run();
    const accessToken = await signAccessToken({
      sub: record.userId,
      sessionId: newSessionId,
    });
    return { accessToken, newRefreshToken: newRawToken };
  }

  async logout(rawToken: string): Promise<void> {
    this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.hashedToken, hashToken(rawToken)))
      .run();
  }

  getUser(userId: string) {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw unauthorized("User not found");
    return this.toUserDto(user);
  }

  private recordFailedLogin(user: typeof users.$inferSelect): never {
    const attempts = user.failedLoginAttempts + 1;
    const lockoutUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? expiresAtMinutes(LOCKOUT_DURATION_MINUTES)
        : null;
    this.db
      .update(users)
      .set({ failedLoginAttempts: attempts, lockoutUntil })
      .where(eq(users.id, user.id))
      .run();
    if (lockoutUntil) {
      throw forbidden(
        `Account locked due to too many failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
      );
    }
    throw unauthorized("Invalid credentials");
  }
}
