import { eq, and } from "drizzle-orm";
import type { AppDb } from "../../types.js";
import type { ApiKeyDto, ApiKeyCreatedDto } from "@kanban/shared";
import { generateId } from "../../lib/id.js";
import { generateToken } from "../../lib/token.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { notFound } from "../../lib/errors.js";
import { apiKeys } from "../../db/schema/index.js";

/**
 * Raw key format: kbk_<keyId>_<secret>
 * keyId (the DB record ID) is embedded so the server can look up the record
 * before doing the expensive hash verify. Only the full raw key is hashed.
 */
function buildRawKey(keyId: string, secret: string): string {
  return `kbk_${keyId}_${secret}`;
}

function parseRawKey(
  rawKey: string,
): { keyId: string; rawKey: string } | undefined {
  const match = /^kbk_([^_]+)_(.+)$/.exec(rawKey);
  if (!match) return undefined;
  return { keyId: match[1]!, rawKey };
}

function toApiKeyDto(row: typeof apiKeys.$inferSelect): ApiKeyDto {
  return {
    id: row.id,
    label: row.label,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

export class ApiKeyService {
  constructor(private readonly db: AppDb) {}

  async createKey(userId: string, label: string): Promise<ApiKeyCreatedDto> {
    const keyId = generateId();
    const secret = generateToken();
    const rawKey = buildRawKey(keyId, secret);
    const hashedKey = await hashPassword(rawKey);

    const row = this.db
      .insert(apiKeys)
      .values({ id: keyId, userId, hashedKey, label })
      .returning()
      .get();
    if (!row) throw new Error("Failed to create API key");

    return { ...toApiKeyDto(row), rawKey };
  }

  listKeys(userId: string): ApiKeyDto[] {
    return this.db
      .select({
        id: apiKeys.id,
        label: apiKeys.label,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .all();
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const existing = this.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .get();
    if (!existing) throw notFound("API key not found");

    this.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .run();
  }

  /**
   * Resolve a raw API key to a userId. Used by MCP auth middleware.
   * Updates lastUsedAt on success.
   */
  async resolveKey(rawKey: string): Promise<string | undefined> {
    const parsed = parseRawKey(rawKey);
    if (!parsed) return undefined;

    const record = this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, parsed.keyId))
      .get();
    if (!record) return undefined;

    const valid = await verifyPassword(record.hashedKey, rawKey);
    if (!valid) return undefined;

    this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, record.id))
      .run();

    return record.userId;
  }
}
