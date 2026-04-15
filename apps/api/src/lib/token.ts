import { randomBytes, createHash } from "node:crypto";

/** Generate a cryptographically random 32-byte hex string. */
export const generateToken = (): string => randomBytes(32).toString("hex");

/**
 * One-way SHA-256 hash for storing random tokens (not passwords).
 * Suitable for refresh tokens and invitation tokens — NOT for passwords (use argon2).
 */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
