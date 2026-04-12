/**
 * CJS-safe wrapper for otplib.
 *
 * otplib@13 has "type":"module" which makes Vitest 1-2 switch the entire
 * module graph into ESM SSR mode, breaking native CJS addons (better-sqlite3,
 * argon2). Loading the explicit .cjs entry via createRequire bypasses that.
 */
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Use createRequire so Node resolves the "require" condition in otplib's
// exports map (→ ./dist/index.cjs) instead of the ESM default.
const { authenticator } = _require('otplib') as any

export { authenticator }
