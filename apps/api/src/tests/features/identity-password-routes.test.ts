import { describe, it, expect, beforeAll } from "vitest";
import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  return { app, db: testDb.db, close: testDb.close };
}

describe("POST /auth/refresh", () => {
  it("issues a new accessToken given a valid refresh cookie", async () => {
    const { app, db, close } = setup();
    const { cookieHeader } = await loginTestUser(app, db, {
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice",
    });
    const match = new RegExp(`${KB_REFRESH_TOKEN_COOKIE}=([^;]+)`).exec(
      cookieHeader,
    );
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { Cookie: `${KB_REFRESH_TOKEN_COOKIE}=${match?.[1] ?? ""}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(typeof body.accessToken).toBe("string");
    close();
  });

  it("returns 401 with no cookie", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/refresh", { method: "POST" });
    expect(res.status).toBe(401);
    close();
  });
});

describe("POST /auth/logout", () => {
  it("returns 200 and clears the cookie", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    close();
  });
});

describe("password and verification recovery routes", () => {
  it("returns 200 for forgot password and public verification resend", async () => {
    const { app, close } = setup();
    const forgot = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });
    const resend = await app.request("/auth/resend-verification-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });
    expect(forgot.status).toBe(200);
    expect(resend.status).toBe(200);
    close();
  });

  it("returns 400 for invalid recovery payloads", async () => {
    const { app, close } = setup();
    const forgot = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const reset = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    });
    const resend = await app.request("/auth/resend-verification-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });
    expect(forgot.status).toBe(400);
    expect(reset.status).toBe(400);
    expect(resend.status).toBe(400);
    close();
  });

  it("returns 401 for an invalid reset token", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "bad-token", password: "newpass123" }),
    });
    expect(res.status).toBe(401);
    close();
  });
});
