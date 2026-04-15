import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";
import { authnMiddleware } from "../../middleware/authn.js";
import { signAccessToken } from "../../lib/jwt.js";
import type { HonoEnv } from "../../types.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
});

function makeApp() {
  const app = new Hono<HonoEnv>();
  app.use("*", authnMiddleware);
  app.get("/me", (c) =>
    c.json({ userId: c.get("userId"), sessionId: c.get("sessionId") }),
  );
  return app;
}

describe("authnMiddleware", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await makeApp().request("/me");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed Bearer token", async () => {
    const res = await makeApp().request("/me", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects non-Bearer auth schemes", async () => {
    const res = await makeApp().request("/me", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });

  it("sets userId and sessionId for a valid token", async () => {
    const token = await signAccessToken({
      sub: "user-123",
      sessionId: "sess-456",
    });
    const res = await makeApp().request("/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; sessionId: string };
    expect(body.userId).toBe("user-123");
    expect(body.sessionId).toBe("sess-456");
  });
});
