export class TotpRequiredError extends Error {
  constructor() {
    super("TOTP_REQUIRED");
  }
}
