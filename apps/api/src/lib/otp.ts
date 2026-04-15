/**
 * CJS-safe wrapper for otplib v13.
 *
 * otplib@13 has "type":"module" which makes Vitest switch the entire
 * module graph into ESM SSR mode, breaking native CJS addons (better-sqlite3,
 * argon2). Loading via createRequire bypasses that.
 *
 * otplib v13 dropped the `authenticator` singleton — this shim restores the
 * same interface so callers don't need to change.
 */
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

const { generateSecret, generateURI, verifySync } = _require("otplib") as {
  generateSecret: () => string;
  generateURI: (opts: {
    strategy: string;
    label: string;
    issuer: string;
    secret: string;
  }) => string;
  verifySync: (opts: { token: string; secret: string; strategy: string }) => {
    valid: boolean;
  };
};

// Re-expose the v11-style authenticator interface
export const authenticator = {
  generateSecret: (): string => generateSecret(),
  /** account = user identifier (email), service = app name (issuer) */
  keyuri: (account: string, service: string, secret: string): string =>
    generateURI({ strategy: "totp", label: account, issuer: service, secret }),
  verify: ({ token, secret }: { token: string; secret: string }): boolean =>
    verifySync({ token, secret, strategy: "totp" }).valid,
};
