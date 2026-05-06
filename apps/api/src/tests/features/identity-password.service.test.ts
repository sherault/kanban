import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { passwordResets, users } from "../../db/schema/index.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { generateId } from "../../lib/id.js";
import { generateToken, hashToken } from "../../lib/token.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

describe("IdentityService.requestPasswordReset", () => {
  it("succeeds silently for unknown email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(
      svc.requestPasswordReset("nobody@example.com"),
    ).resolves.toBeUndefined();
    close();
  });

  it("succeeds for known email and replaces existing reset tokens", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "eve@example.com",
      password: "pw",
      displayName: "Eve",
    });
    await svc.requestPasswordReset("eve@example.com");
    await expect(
      svc.requestPasswordReset("eve@example.com"),
    ).resolves.toBeUndefined();
    close();
  });
});

describe("IdentityService.resetPassword", () => {
  it("changes the password and allows login with new password", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "frank@example.com",
      password: "oldpass",
      displayName: "Frank",
    });
    await svc.resetPassword(
      await insertResetToken(db, "frank@example.com"),
      "newpass123",
    );
    const result = await svc.login({
      email: "frank@example.com",
      password: "newpass123",
    });
    expect(typeof result.accessToken).toBe("string");
    close();
  });

  it("throws 401 for invalid token", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(
      svc.resetPassword("bad-token", "newpass123"),
    ).rejects.toMatchObject({ status: 401 });
    close();
  });

  it("invalidates all sessions on successful reset", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "grace@example.com",
      password: "oldpass",
      displayName: "Grace",
    });
    const { refreshToken } = await svc.login({
      email: "grace@example.com",
      password: "oldpass",
    });
    await svc.resetPassword(
      await insertResetToken(db, "grace@example.com"),
      "newpass123",
    );
    await expect(svc.refresh(refreshToken)).rejects.toMatchObject({
      status: 401,
    });
    close();
  });
});

describe("IdentityService.resendVerificationByEmail", () => {
  it("succeeds silently for unknown or already-verified email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "hank@example.com",
      password: "pw",
      displayName: "Hank",
    });
    await expect(
      svc.resendVerificationByEmail("nobody@example.com"),
    ).resolves.toBeUndefined();
    await expect(
      svc.resendVerificationByEmail("hank@example.com"),
    ).resolves.toBeUndefined();
    close();
  });

  it("sends a new token for an unverified email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await svc.register({
      email: "ivy@example.com",
      password: "pw12345678",
      displayName: "Ivy",
    });
    await expect(
      svc.resendVerificationByEmail("ivy@example.com"),
    ).resolves.toBeUndefined();
    close();
  });
});

async function insertResetToken(
  db: ReturnType<typeof createTestDb>["db"],
  email: string,
): Promise<string> {
  const rawToken = generateToken();
  const user = db.select().from(users).where(eq(users.email, email)).get()!;
  const future = new Date();
  future.setHours(future.getHours() + 1);
  db.insert(passwordResets)
    .values({
      id: generateId(),
      userId: user.id,
      hashedToken: hashToken(rawToken),
      expiresAt: future.toISOString(),
    })
    .run();
  return rawToken;
}
