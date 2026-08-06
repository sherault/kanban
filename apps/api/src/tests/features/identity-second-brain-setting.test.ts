import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../../db/test-utils.js";
import { createApp } from "../../app.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  return { app, close: testDb.close };
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
});
