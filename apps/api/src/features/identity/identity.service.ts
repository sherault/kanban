import type { UserDto } from "@kanban/shared";
import type { AppDb } from "../../types.js";
import { IdentityPasswordOperations } from "./identity-service/password.js";
import { IdentityRegistrationOperations } from "./identity-service/registration.js";
import { IdentitySessionOperations } from "./identity-service/sessions.js";
import { IdentityTotpSettingsOperations } from "./identity-service/totp-settings.js";
import { TotpRequiredError } from "./identity-service/totp-required-error.js";
import type {
  LoginInput,
  LoginResult,
  RefreshResult,
  RegisterInput,
  TotpSetupResult,
  UserSettingsInput,
} from "./identity-service/types.js";

export { TotpRequiredError };

export class IdentityService {
  private readonly password: IdentityPasswordOperations;
  private readonly registration: IdentityRegistrationOperations;
  private readonly sessions: IdentitySessionOperations;
  private readonly totpSettings: IdentityTotpSettingsOperations;

  constructor(db: AppDb) {
    this.password = new IdentityPasswordOperations(db);
    this.registration = new IdentityRegistrationOperations(db);
    this.sessions = new IdentitySessionOperations(db);
    this.totpSettings = new IdentityTotpSettingsOperations(db);
  }

  register(input: RegisterInput): Promise<UserDto> {
    return this.registration.register(input);
  }

  verifyEmail(rawToken: string): Promise<void> {
    return this.registration.verifyEmail(rawToken);
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.password.requestPasswordReset(email);
  }

  resetPassword(rawToken: string, newPassword: string): Promise<void> {
    return this.password.resetPassword(rawToken, newPassword);
  }

  resendVerificationByEmail(email: string): Promise<void> {
    return this.registration.resendVerificationByEmail(email);
  }

  resendVerification(userId: string): Promise<void> {
    return this.registration.resendVerification(userId);
  }

  login(input: LoginInput): Promise<LoginResult> {
    return this.sessions.login(input);
  }

  refresh(rawToken: string): Promise<RefreshResult> {
    return this.sessions.refresh(rawToken);
  }

  logout(rawToken: string): Promise<void> {
    return this.sessions.logout(rawToken);
  }

  getUser(userId: string): UserDto {
    return this.sessions.getUser(userId);
  }

  setupTotp(userId: string): Promise<TotpSetupResult> {
    return this.totpSettings.setupTotp(userId);
  }

  enableTotp(userId: string, code: string): void {
    this.totpSettings.enableTotp(userId, code);
  }

  disableTotp(userId: string, code: string): void {
    this.totpSettings.disableTotp(userId, code);
  }

  updateSettings(
    userId: string,
    settings: UserSettingsInput,
  ): Promise<UserDto> {
    return this.totpSettings.updateSettings(userId, settings);
  }
}
