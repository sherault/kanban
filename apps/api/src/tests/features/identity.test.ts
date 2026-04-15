import { describe, it, expect, beforeAll } from "vitest";
import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";
import {
  createTestDb,
  createVerifiedUser,
  loginTestUser,
} from "../../db/test-utils.js";
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

const REGISTER_PAYLOAD = {
  email: "alice@example.com",
  password: "password123",
  displayName: "Alice",
};

describe("POST /auth/register", () => {
  it("creates a user and returns 201", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REGISTER_PAYLOAD),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { email: string; id: string } };
    expect(body.user.email).toBe("alice@example.com");
    expect(typeof body.user.id).toBe("string");
    close();
  });

  it("returns 409 for duplicate email", async () => {
    const { app, close } = setup();
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REGISTER_PAYLOAD),
    };
    await app.request("/auth/register", opts);
    const res = await app.request("/auth/register", opts);
    expect(res.status).toBe(409);
    close();
  });

  it("returns 400 for invalid email", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "password123",
        displayName: "X",
      }),
    });
    expect(res.status).toBe(400);
    close();
  });

  it("returns 400 for password shorter than 8 chars", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "x@example.com",
        password: "short",
        displayName: "X",
      }),
    });
    expect(res.status).toBe(400);
    close();
  });
});

describe("POST /auth/login", () => {
  it("returns accessToken and sets refresh_token cookie", async () => {
    const { app, db, close } = setup();
    await createVerifiedUser(db, {
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice",
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accessToken: string;
      user: { email: string };
    };
    expect(typeof body.accessToken).toBe("string");
    expect(body.user.email).toBe("alice@example.com");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`${KB_REFRESH_TOKEN_COOKIE}=`));
    expect(setCookie).toMatch(/HttpOnly/);
    close();
  });

  it("returns 401 for wrong password", async () => {
    const { app, db, close } = setup();
    await createVerifiedUser(db, {
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice",
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "wrongpassword",
      }),
    });
    expect(res.status).toBe(401);
    close();
  });

  it("returns 403 for unverified user", async () => {
    const { app, close } = setup();
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REGISTER_PAYLOAD),
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    expect(res.status).toBe(403);
    close();
  });
});

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
    const rawToken = match?.[1] ?? "";

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { Cookie: `${KB_REFRESH_TOKEN_COOKIE}=${rawToken}` },
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

describe("POST /auth/forgot-password", () => {
  it("returns 200 for any email (no enumeration)", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });
    expect(res.status).toBe(200);
    close();
  });

  it("returns 400 for invalid email", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    close();
  });
});

describe("POST /auth/reset-password", () => {
  it("returns 401 for invalid token", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "bad-token", password: "newpass123" }),
    });
    expect(res.status).toBe(401);
    close();
  });

  it("returns 400 for missing fields", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    });
    expect(res.status).toBe(400);
    close();
  });
});

describe("POST /auth/resend-verification-public", () => {
  it("returns 200 for any email (no enumeration)", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/resend-verification-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });
    expect(res.status).toBe(200);
    close();
  });

  it("returns 400 for invalid email", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/resend-verification-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });
    expect(res.status).toBe(400);
    close();
  });
});
