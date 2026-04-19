import { eq } from "drizzle-orm";
import type { AppDb } from "../../types.js";
import type { InvitationTokenDto, UserDto } from "@kanban/shared";
import { generateId } from "../../lib/id.js";
import { generateToken, hashToken } from "../../lib/token.js";
import { hashPassword } from "../../lib/password.js";
import { signAccessToken } from "../../lib/jwt.js";
import { notFound, conflict } from "../../lib/errors.js";
import {
  invitationTokens,
  users,
  memberships,
  organizations,
  refreshTokens,
} from "../../db/schema/index.js";

const INVITE_TTL_DAYS = 7;
const REFRESH_TTL_DAYS = 7;

function expiresAt(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

interface CreateInviteResult extends InvitationTokenDto {
  rawToken: string;
}

interface AcceptInput {
  email: string;
  password: string;
  displayName: string;
}

interface AcceptResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export class InvitationService {
  constructor(private readonly db: AppDb) {}

  createInvitation(orgId: string, createdBy: string): CreateInviteResult {
    const id = generateId();
    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);
    const exp = expiresAt(INVITE_TTL_DAYS);

    const row = this.db
      .insert(invitationTokens)
      .values({
        id,
        organizationId: orgId,
        createdBy,
        hashedToken,
        expiresAt: exp,
      })
      .returning()
      .get();
    if (!row) throw new Error("Failed to create invitation");

    return {
      id: row.id,
      organizationId: row.organizationId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      rawToken,
    };
  }

  listInvitations(orgId: string): InvitationTokenDto[] {
    return this.db
      .select({
        id: invitationTokens.id,
        organizationId: invitationTokens.organizationId,
        expiresAt: invitationTokens.expiresAt,
        createdAt: invitationTokens.createdAt,
      })
      .from(invitationTokens)
      .where(eq(invitationTokens.organizationId, orgId))
      .all();
  }

  getOrgByToken(rawToken: string): { id: string; name: string } | undefined {
    const hashedToken = hashToken(rawToken);
    const record = this.db
      .select()
      .from(invitationTokens)
      .where(eq(invitationTokens.hashedToken, hashedToken))
      .get();
    if (!record || record.usedAt || new Date(record.expiresAt) < new Date())
      return undefined;

    const org = this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, record.organizationId))
      .get();
    return org;
  }

  async acceptInvitation(
    rawToken: string,
    input: AcceptInput,
  ): Promise<AcceptResult> {
    const hashedToken = hashToken(rawToken);
    const record = this.db
      .select()
      .from(invitationTokens)
      .where(eq(invitationTokens.hashedToken, hashedToken))
      .get();
    if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
      throw notFound("Invitation not found or expired");
    }

    // Check email not already taken
    const existing = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .get();
    if (existing) throw conflict("Email already registered");

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(input.password);
    const user = this.db
      .insert(users)
      .values({
        id: userId,
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      })
      .returning()
      .get();
    if (!user) throw new Error("Failed to create user");

    // Join org as member
    this.db
      .insert(memberships)
      .values({ userId, organizationId: record.organizationId, role: "member" })
      .run();

    // Mark invitation as used
    this.db
      .update(invitationTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(invitationTokens.id, record.id))
      .run();

    // Issue tokens
    const sessionId = generateId();
    const rawRefreshToken = generateToken();
    this.db
      .insert(refreshTokens)
      .values({
        id: sessionId,
        userId,
        hashedToken: hashToken(rawRefreshToken),
        expiresAt: expiresAt(REFRESH_TTL_DAYS),
      })
      .run();

    const accessToken = await signAccessToken({ sub: userId, sessionId });
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled,
        maxOpenPanels: user.maxOpenPanels,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
