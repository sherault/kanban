import { eq } from "drizzle-orm";
import {
  passwordResets,
  refreshTokens,
  users,
} from "../../../db/schema/index.js";
import { unauthorized } from "../../../lib/errors.js";
import { generateId } from "../../../lib/id.js";
import { sendPasswordResetEmail } from "../../../lib/mailer.js";
import { hashPassword } from "../../../lib/password.js";
import { generateToken, hashToken } from "../../../lib/token.js";
import { expiresAtHours, IdentityBase, RESET_TTL_HOURS } from "./base.js";

export class IdentityPasswordOperations extends IdentityBase {
  async requestPasswordReset(email: string): Promise<void> {
    const user = this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (!user) return;

    this.db
      .delete(passwordResets)
      .where(eq(passwordResets.userId, user.id))
      .run();
    const rawToken = generateToken();
    this.db
      .insert(passwordResets)
      .values({
        id: generateId(),
        userId: user.id,
        hashedToken: hashToken(rawToken),
        expiresAt: expiresAtHours(RESET_TTL_HOURS),
      })
      .run();
    void sendPasswordResetEmail(user.email, rawToken).catch((error) => {
      console.error("[mailer] Failed to send password reset email:", error);
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = this.db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.hashedToken, hashToken(rawToken)))
      .get();
    if (!record) throw unauthorized("Invalid or expired reset link");
    if (new Date(record.expiresAt) < new Date()) {
      this.db
        .delete(passwordResets)
        .where(eq(passwordResets.id, record.id))
        .run();
      throw unauthorized("Reset link has expired");
    }

    this.db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, record.userId))
      .run();
    this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, record.userId))
      .run();
    this.db
      .delete(passwordResets)
      .where(eq(passwordResets.id, record.id))
      .run();
  }
}
