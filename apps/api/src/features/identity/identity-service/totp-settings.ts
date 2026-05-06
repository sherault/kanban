import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { authenticator } from "../../../lib/otp.js";
import { users } from "../../../db/schema/index.js";
import { forbidden, unauthorized } from "../../../lib/errors.js";
import { IdentityBase } from "./base.js";
import type { TotpSetupResult, UserSettingsInput } from "./types.js";

export class IdentityTotpSettingsOperations extends IdentityBase {
  async setupTotp(userId: string): Promise<TotpSetupResult> {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw unauthorized("User not found");

    const secret = authenticator.generateSecret();
    const uri = authenticator.keyuri(user.email, "Kanban", secret);
    const qrCode = await QRCode.toDataURL(uri);
    this.db
      .update(users)
      .set({ totpSecret: secret, totpEnabled: false })
      .where(eq(users.id, userId))
      .run();
    return { secret, uri, qrCode };
  }

  enableTotp(userId: string, code: string): void {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user?.totpSecret) throw forbidden("TOTP not set up");
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw unauthorized("Invalid authenticator code");
    }
    this.db
      .update(users)
      .set({ totpEnabled: true })
      .where(eq(users.id, userId))
      .run();
  }

  disableTotp(userId: string, code: string): void {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user?.totpEnabled || !user.totpSecret)
      throw forbidden("TOTP not enabled");
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw unauthorized("Invalid authenticator code");
    }
    this.db
      .update(users)
      .set({ totpEnabled: false, totpSecret: null })
      .where(eq(users.id, userId))
      .run();
  }

  async updateSettings(userId: string, settings: UserSettingsInput) {
    const user = this.db
      .update(users)
      .set(normalizeUserSettings(settings))
      .where(eq(users.id, userId))
      .returning()
      .get();
    if (!user) throw unauthorized("User not found");
    return this.toUserDto(user);
  }
}

export function normalizeUserSettings(settings: UserSettingsInput) {
  return {
    ...(settings.maxOpenPanels !== undefined && {
      maxOpenPanels: Math.min(10, Math.max(1, settings.maxOpenPanels)),
    }),
    ...(settings.enableNotifications !== undefined && {
      enableNotifications: settings.enableNotifications,
    }),
    ...(settings.maxNotifications !== undefined && {
      maxNotifications: Math.min(5, Math.max(1, settings.maxNotifications)),
    }),
    ...(settings.notificationDuration !== undefined && {
      notificationDuration: Math.min(
        30,
        Math.max(1, settings.notificationDuration),
      ),
    }),
  };
}
