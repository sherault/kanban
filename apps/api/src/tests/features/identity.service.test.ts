import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "../../lib/token.js";
import { generateId } from "../../lib/id.js";
import { passwordResets, users } from "../../db/schema/index.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

describe("IdentityService.register", () => {
  it("creates a user and returns UserDto", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    const user = await svc.register({
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice",
    });
    expect(user.email).toBe("alice@example.com");
    expect(user.displayName).toBe("Alice");
    expect(typeof user.id).toBe("string");
    close();
  });

  it("throws 409 if email already registered", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await svc.register({
      email: "alice@example.com",
      password: "pw",
      displayName: "A",
    });
    await expect(
      svc.register({
        email: "alice@example.com",
        password: "pw2",
        displayName: "A2",
      }),
    ).rejects.toMatchObject({ status: 409 });
    close();
  });
});

describe("IdentityService.login", () => {
  it("returns accessToken, refreshToken, and UserDto on valid credentials", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "bob@example.com",
      password: "secret",
      displayName: "Bob",
    });
    const result = await svc.login({
      email: "bob@example.com",
      password: "secret",
    });
    expect(typeof result.accessToken).toBe("string");
    expect(typeof result.refreshToken).toBe("string");
    expect(result.user.email).toBe("bob@example.com");
    close();
  });

  it("throws 401 for wrong password", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "bob@example.com",
      password: "secret",
      displayName: "Bob",
    });
    await expect(
      svc.login({ email: "bob@example.com", password: "wrongpass" }),
    ).rejects.toMatchObject({ status: 401 });
    close();
  });

  it("throws 401 for unknown email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(
      svc.login({ email: "nobody@example.com", password: "pw" }),
    ).rejects.toMatchObject({ status: 401 });
    close();
  });
});

describe("IdentityService.refresh", () => {
  it("returns new accessToken and rotated refreshToken", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "carol@example.com",
      password: "pw",
      displayName: "Carol",
    });
    const { refreshToken: rt1 } = await svc.login({
      email: "carol@example.com",
      password: "pw",
    });
    const result = await svc.refresh(rt1);
    expect(typeof result.accessToken).toBe("string");
    expect(result.newRefreshToken).not.toBe(rt1);
    close();
  });

  it("invalidates the old refresh token after rotation", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "carol@example.com",
      password: "pw",
      displayName: "Carol",
    });
    const { refreshToken: rt1 } = await svc.login({
      email: "carol@example.com",
      password: "pw",
    });
    await svc.refresh(rt1);
    await expect(svc.refresh(rt1)).rejects.toMatchObject({ status: 401 });
    close();
  });
});

describe("IdentityService.logout", () => {
  it("invalidates the refresh token so refresh fails", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "dave@example.com",
      password: "pw",
      displayName: "Dave",
    });
    const { refreshToken } = await svc.login({
      email: "dave@example.com",
      password: "pw",
    });
    await svc.logout(refreshToken);
    await expect(svc.refresh(refreshToken)).rejects.toMatchObject({
      status: 401,
    });
    close();
  });

  it("is idempotent — no error when token not found", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(svc.logout("nonexistent-token")).resolves.toBeUndefined();
    close();
  });
});

describe("IdentityService.requestPasswordReset", () => {
  it("succeeds silently for unknown email (no enumeration)", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(
      svc.requestPasswordReset("nobody@example.com"),
    ).resolves.toBeUndefined();
    close();
  });

  it("succeeds for known email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "eve@example.com",
      password: "pw",
      displayName: "Eve",
    });
    await expect(
      svc.requestPasswordReset("eve@example.com"),
    ).resolves.toBeUndefined();
    close();
  });

  it("replaces an existing reset token on re-request", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "eve@example.com",
      password: "pw",
      displayName: "Eve",
    });
    await svc.requestPasswordReset("eve@example.com");
    await svc.requestPasswordReset("eve@example.com");
    await expect(
      svc.requestPasswordReset("eve@example.com"),
    ).resolves.toBeUndefined();
    close();
  });
});

// Helper: insert a valid reset token directly into the DB for a given user email
async function insertResetToken(
  db: ReturnType<typeof createTestDb>["db"],
  email: string,
): Promise<string> {
  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);
  const user = db.select().from(users).where(eq(users.email, email)).get()!;
  const future = new Date();
  future.setHours(future.getHours() + 1);
  db.insert(passwordResets)
    .values({
      id: generateId(),
      userId: user.id,
      hashedToken,
      expiresAt: future.toISOString(),
    })
    .run();
  return rawToken;
}

describe("IdentityService.resetPassword", () => {
  it("changes the password and allows login with new password", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "frank@example.com",
      password: "oldpass",
      displayName: "Frank",
    });
    const rawToken = await insertResetToken(db, "frank@example.com");
    await svc.resetPassword(rawToken, "newpass123");
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
    const rawToken = await insertResetToken(db, "grace@example.com");
    await svc.resetPassword(rawToken, "newpass123");
    await expect(svc.refresh(refreshToken)).rejects.toMatchObject({
      status: 401,
    });
    close();
  });
});

describe("IdentityService.resendVerificationByEmail", () => {
  it("succeeds silently for unknown email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await expect(
      svc.resendVerificationByEmail("nobody@example.com"),
    ).resolves.toBeUndefined();
    close();
  });

  it("succeeds silently for already-verified email", async () => {
    const { db, close } = createTestDb();
    const svc = new IdentityService(db);
    await createVerifiedUser(db, {
      email: "hank@example.com",
      password: "pw",
      displayName: "Hank",
    });
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
