import { eq } from "drizzle-orm";
import { users, emailVerifications } from "../../../db/schema/index.js";
import { conflict, unauthorized } from "../../../lib/errors.js";
import { generateId } from "../../../lib/id.js";
import { sendVerificationEmail } from "../../../lib/mailer.js";
import { hashPassword } from "../../../lib/password.js";
import { generateToken, hashToken } from "../../../lib/token.js";
import { expiresAtHours, IdentityBase, VERIFY_TTL_HOURS } from "./base.js";
import type { RegisterInput } from "./types.js";

export class IdentityRegistrationOperations extends IdentityBase {
  async register(input: RegisterInput) {
    const existing = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .get();
    if (existing) throw conflict("Email already registered");

    try {
      const user = this.db
        .insert(users)
        .values({
          id: generateId(),
          email: input.email,
          passwordHash: await hashPassword(input.password),
          displayName: input.displayName,
        })
        .returning()
        .get();
      if (!user) throw new Error("Failed to create user");
      this.createVerificationToken(user.id, input.email);
      return this.toUserDto(user);
    } catch (error) {
      console.error("[IdentityService] Register failed:", error);
      throw error;
    }
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const record = this.db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.hashedToken, hashToken(rawToken)))
      .get();
    if (!record) throw unauthorized("Invalid or expired verification link");
    if (new Date(record.expiresAt) < new Date()) {
      this.db
        .delete(emailVerifications)
        .where(eq(emailVerifications.id, record.id))
        .run();
      throw unauthorized("Verification link has expired");
    }
    this.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, record.userId))
      .run();
    this.db
      .delete(emailVerifications)
      .where(eq(emailVerifications.id, record.id))
      .run();
  }

  async resendVerificationByEmail(email: string): Promise<void> {
    const user = this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (!user || user.emailVerified) return;
    this.db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id))
      .run();
    this.createVerificationToken(user.id, user.email, true);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw unauthorized("User not found");
    if (user.emailVerified) return;
    this.db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, userId))
      .run();
    const rawToken = this.insertVerificationToken(userId);
    await sendVerificationEmail(user.email, rawToken);
  }

  private createVerificationToken(
    userId: string,
    email: string,
    isResend = false,
  ) {
    const rawToken = this.insertVerificationToken(userId);
    void sendVerificationEmail(email, rawToken).catch((error) => {
      const action = isResend ? "resend verification" : "send verification";
      console.error(`[mailer] Failed to ${action} email:`, error);
    });
  }

  private insertVerificationToken(userId: string) {
    const rawToken = generateToken();
    this.db
      .insert(emailVerifications)
      .values({
        id: generateId(),
        userId,
        hashedToken: hashToken(rawToken),
        expiresAt: expiresAtHours(VERIFY_TTL_HOURS),
      })
      .run();
    return rawToken;
  }
}
