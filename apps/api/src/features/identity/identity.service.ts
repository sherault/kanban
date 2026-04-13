import { eq } from 'drizzle-orm'
import { authenticator } from '../../lib/otp.js'
import QRCode from 'qrcode'
import type { AppDb } from '../../types.js'
import type { UserDto } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { generateToken, hashToken } from '../../lib/token.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { signAccessToken } from '../../lib/jwt.js'
import { conflict, unauthorized, forbidden } from '../../lib/errors.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/mailer.js'
import { users, refreshTokens, emailVerifications, passwordResets } from '../../db/schema/index.js'

interface RegisterInput {
  email: string
  password: string
  displayName: string
}

interface LoginInput {
  email: string
  password: string
  totpCode?: string
}

interface LoginResult {
  user: UserDto
  accessToken: string
  refreshToken: string
}

interface RefreshResult {
  accessToken: string
  newRefreshToken: string
}

interface TotpSetupResult {
  secret: string
  uri: string
  qrCode: string
}

const REFRESH_TTL_DAYS = 7
const VERIFY_TTL_HOURS = 24
const RESET_TTL_HOURS = 1

function expiresAt(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function expiresAtHours(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}

function toUserDto(row: typeof users.$inferSelect): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    emailVerified: row.emailVerified,
    totpEnabled: row.totpEnabled,
    createdAt: row.createdAt,
  }
}

export class IdentityService {
  constructor(private readonly db: AppDb) {}

  async register(input: RegisterInput): Promise<UserDto> {
    const existing = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .get()
    if (existing) throw conflict('Email already registered')

    const passwordHash = await hashPassword(input.password)
    const id = generateId()
    const user = this.db
      .insert(users)
      .values({ id, email: input.email, passwordHash, displayName: input.displayName })
      .returning()
      .get()
    if (!user) throw new Error('Failed to create user')

    // Send verification email (fire-and-forget — don't block registration)
    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(emailVerifications)
      .values({ id: generateId(), userId: id, hashedToken, expiresAt: expiresAtHours(VERIFY_TTL_HOURS) })
      .run()
    void sendVerificationEmail(input.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to send verification email:', err)
    })

    return toUserDto(user)
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const hashedToken = hashToken(rawToken)
    const record = this.db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.hashedToken, hashedToken))
      .get()
    if (!record) throw unauthorized('Invalid or expired verification link')
    if (new Date(record.expiresAt) < new Date()) {
      this.db.delete(emailVerifications).where(eq(emailVerifications.id, record.id)).run()
      throw unauthorized('Verification link has expired')
    }
    this.db.update(users).set({ emailVerified: true }).where(eq(users.id, record.userId)).run()
    this.db.delete(emailVerifications).where(eq(emailVerifications.id, record.id)).run()
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user) return

    this.db.delete(passwordResets).where(eq(passwordResets.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(passwordResets)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(RESET_TTL_HOURS) })
      .run()
    void sendPasswordResetEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to send password reset email:', err)
    })
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(rawToken)
    const record = this.db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.hashedToken, hashedToken))
      .get()
    if (!record) throw unauthorized('Invalid or expired reset link')
    if (new Date(record.expiresAt) < new Date()) {
      this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
      throw unauthorized('Reset link has expired')
    }
    const passwordHash = await hashPassword(newPassword)
    this.db.update(users).set({ passwordHash }).where(eq(users.id, record.userId)).run()
    this.db.delete(refreshTokens).where(eq(refreshTokens.userId, record.userId)).run()
    this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
  }

  async resendVerificationByEmail(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user || user.emailVerified) return

    this.db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(emailVerifications)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(VERIFY_TTL_HOURS) })
      .run()
    void sendVerificationEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to resend verification email:', err)
    })
  }

  async resendVerification(userId: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) throw unauthorized('User not found')
    if (user.emailVerified) return

    // Delete any existing tokens
    this.db.delete(emailVerifications).where(eq(emailVerifications.userId, userId)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(emailVerifications)
      .values({ id: generateId(), userId, hashedToken, expiresAt: expiresAtHours(VERIFY_TTL_HOURS) })
      .run()
    await sendVerificationEmail(user.email, rawToken)
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = this.db.select().from(users).where(eq(users.email, input.email)).get()
    if (!user) throw unauthorized('Invalid credentials')

    const valid = await verifyPassword(user.passwordHash, input.password)
    if (!valid) throw unauthorized('Invalid credentials')

    if (!user.emailVerified) {
      throw forbidden('Please verify your email before signing in')
    }

    if (user.totpEnabled && user.totpSecret) {
      if (!input.totpCode) {
        throw new TotpRequiredError()
      }
      const isValid = authenticator.verify({ token: input.totpCode, secret: user.totpSecret })
      if (!isValid) throw unauthorized('Invalid authenticator code')
    }

    const sessionId = generateId()
    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(refreshTokens)
      .values({ id: sessionId, userId: user.id, hashedToken, expiresAt: expiresAt(REFRESH_TTL_DAYS) })
      .run()

    const accessToken = await signAccessToken({ sub: user.id, sessionId })
    return { user: toUserDto(user), accessToken, refreshToken: rawToken }
  }

  async refresh(rawToken: string): Promise<RefreshResult> {
    const hashedToken = hashToken(rawToken)
    const record = this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.hashedToken, hashedToken))
      .get()
    if (!record) throw unauthorized('Invalid refresh token')

    if (new Date(record.expiresAt) < new Date()) {
      this.db.delete(refreshTokens).where(eq(refreshTokens.id, record.id)).run()
      throw unauthorized('Refresh token expired')
    }

    this.db.delete(refreshTokens).where(eq(refreshTokens.id, record.id)).run()
    const newSessionId = generateId()
    const newRawToken = generateToken()
    const newHashedToken = hashToken(newRawToken)
    this.db
      .insert(refreshTokens)
      .values({
        id: newSessionId,
        userId: record.userId,
        hashedToken: newHashedToken,
        expiresAt: expiresAt(REFRESH_TTL_DAYS),
      })
      .run()

    const accessToken = await signAccessToken({ sub: record.userId, sessionId: newSessionId })
    return { accessToken, newRefreshToken: newRawToken }
  }

  async logout(rawToken: string): Promise<void> {
    const hashedToken = hashToken(rawToken)
    this.db.delete(refreshTokens).where(eq(refreshTokens.hashedToken, hashedToken)).run()
  }

  getUser(userId: string): UserDto {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) throw unauthorized('User not found')
    return toUserDto(user)
  }


  async requestPasswordReset(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user) return

    this.db.delete(passwordResets).where(eq(passwordResets.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(passwordResets)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(RESET_TTL_HOURS) })
      .run()
    void sendPasswordResetEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to send password reset email:', err)
    })
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(rawToken)
    const record = this.db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.hashedToken, hashedToken))
      .get()
    if (!record) throw unauthorized('Invalid or expired reset link')
    if (new Date(record.expiresAt) < new Date()) {
      this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
      throw unauthorized('Reset link has expired')
    }
    const passwordHash = await hashPassword(newPassword)
    this.db.update(users).set({ passwordHash }).where(eq(users.id, record.userId)).run()
    this.db.delete(refreshTokens).where(eq(refreshTokens.userId, record.userId)).run()
    this.db.delete(passwordResets).where(eq(passwordResets.id, record.id)).run()
  }

  async resendVerificationByEmail(email: string): Promise<void> {
    const user = this.db.select().from(users).where(eq(users.email, email)).get()
    if (!user || user.emailVerified) return

    this.db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id)).run()

    const rawToken = generateToken()
    const hashedToken = hashToken(rawToken)
    this.db
      .insert(emailVerifications)
      .values({ id: generateId(), userId: user.id, hashedToken, expiresAt: expiresAtHours(VERIFY_TTL_HOURS) })
      .run()
    void sendVerificationEmail(user.email, rawToken).catch((err) => {
      console.error('[mailer] Failed to resend verification email:', err)
    })
  }

  // ── TOTP ─────────────────────────────────────────────────────────────────

  async setupTotp(userId: string): Promise<TotpSetupResult> {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) throw unauthorized('User not found')

    const secret = authenticator.generateSecret()
    const uri = authenticator.keyuri(user.email, 'Kanban', secret)
    const qrCode = await QRCode.toDataURL(uri)

    // Store secret (not yet enabled — enabled after verification)
    this.db.update(users).set({ totpSecret: secret, totpEnabled: false }).where(eq(users.id, userId)).run()

    return { secret, uri, qrCode }
  }

  enableTotp(userId: string, code: string): void {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get()
    if (!user?.totpSecret) throw forbidden('TOTP not set up')
    const isValid = authenticator.verify({ token: code, secret: user.totpSecret })
    if (!isValid) throw unauthorized('Invalid authenticator code')
    this.db.update(users).set({ totpEnabled: true }).where(eq(users.id, userId)).run()
  }

  disableTotp(userId: string, code: string): void {
    const user = this.db.select().from(users).where(eq(users.id, userId)).get()
    if (!user?.totpEnabled || !user.totpSecret) throw forbidden('TOTP not enabled')
    const isValid = authenticator.verify({ token: code, secret: user.totpSecret })
    if (!isValid) throw unauthorized('Invalid authenticator code')
    this.db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, userId)).run()
  }
}

// Sentinel error so routes can return the right response shape
export class TotpRequiredError extends Error {
  constructor() { super('TOTP_REQUIRED') }
}
