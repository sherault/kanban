import { describe, it, expect, beforeAll } from "vitest";
import { signAccessToken, verifyAccessToken } from "../../lib/jwt.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
});

describe("signAccessToken / verifyAccessToken", () => {
  it("round-trips a valid payload", async () => {
    const token = await signAccessToken({ sub: "user-1", sessionId: "sess-1" });
    expect(typeof token).toBe("string");
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.sessionId).toBe("sess-1");
  });

  it("throws on a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", sessionId: "sess-1" });
    const tampered = token.slice(0, -4) + "xxxx";
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("throws when JWT_SECRET is not set", async () => {
    const saved = process.env["JWT_SECRET"];
    delete process.env["JWT_SECRET"];
    await expect(signAccessToken({ sub: "u", sessionId: "s" })).rejects.toThrow(
      "JWT_SECRET",
    );
    process.env["JWT_SECRET"] = saved;
  });
});
