import { describe, it, expect, beforeAll } from "vitest";
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

const REGISTER_PAYLOAD = {
  email: "brain@example.com",
  password: "password123",
  displayName: "Brain",
};

describe("second brain user preference", () => {
  it("defaults to false for a newly registered user", async () => {
    const { app, close } = setup();
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REGISTER_PAYLOAD),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { enableSecondBrain: boolean };
    };
    expect(body.user.enableSecondBrain).toBe(false);
    close();
  });

  it("persists enableSecondBrain and returns it from /auth/me", async () => {
    const { app, db, close } = setup();
    const { accessToken: token } = await loginTestUser(app, db, {
      email: REGISTER_PAYLOAD.email,
      password: REGISTER_PAYLOAD.password,
      displayName: REGISTER_PAYLOAD.displayName,
    });

    const patch = await app.request("/auth/me/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enableSecondBrain: true }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      user: { enableSecondBrain: boolean };
    };
    expect(patched.user.enableSecondBrain).toBe(true);

    const me = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = (await me.json()) as { enableSecondBrain: boolean };
    expect(meBody.enableSecondBrain).toBe(true);
    close();
  });

  it("rejects a non-boolean enableSecondBrain", async () => {
    const { app, db, close } = setup();
    const { accessToken: token } = await loginTestUser(app, db, {
      email: REGISTER_PAYLOAD.email,
      password: REGISTER_PAYLOAD.password,
      displayName: REGISTER_PAYLOAD.displayName,
    });

    const res = await app.request("/auth/me/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enableSecondBrain: "yes" }),
    });
    expect(res.status).toBe(400);
    close();
  });
});
