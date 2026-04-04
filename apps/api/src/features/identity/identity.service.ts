import { eq } from 'drizzle-orm'
import type { AppDb } from '../../types.js'
import type { UserDto } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { generateToken, hashToken } from '../../lib/token.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { signAccessToken } from '../../lib/jwt.js'
import { conflict, unauthorized } from '../../lib/errors.js'
import { users, refreshTokens } from '../../db/schema/index.js'

interface RegisterInput {
  email: string
  password: string
  displayName: string
}

interface LoginInput {
  email: string
  password: string
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

const REFRESH_TTL_DAYS = 7

function expiresAt(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function toUserDto(row: typeof users.$inferSelect): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
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
    return toUserDto(user)
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .get()
    if (!user) throw unauthorized('Invalid credentials')

    const valid = await verifyPassword(user.passwordHash, input.password)
    if (!valid) throw unauthorized('Invalid credentials')

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

    // Rotate: delete old, issue new
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
}
