import { describe, it, expect, beforeAll } from "vitest";
import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
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

  it("returns 400 for invalid registration data", async () => {
    const { app, close } = setup();
    const badEmail = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "password123",
        displayName: "X",
      }),
    });
    const shortPassword = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "x@example.com",
        password: "short",
        displayName: "X",
      }),
    });
    expect(badEmail.status).toBe(400);
    expect(shortPassword.status).toBe(400);
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
