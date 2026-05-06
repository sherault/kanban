import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppDb, HonoEnv } from "../../types.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { IdentityService, TotpRequiredError } from "./identity.service.js";
import { unauthorized } from "../../lib/errors.js";
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from "./identity-routes/cookies.js";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  settingsSchema,
  totpCodeSchema,
} from "./identity-routes/schemas.js";

export function identityRoutes(db: AppDb): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();
  const svc = new IdentityService(db);

  // ── Public ─────────────────────────────────────────────────────────────────

  const authRateLimit = rateLimit(10, 15 * 60 * 1000); // 10 attempts per 15 minutes

  router.post(
    "/register",
    authRateLimit,
    zValidator("json", registerSchema),
    async (c) => {
      const body = c.req.valid("json");
      const user = await svc.register(body);
      return c.json({ user }, 201);
    },
  );

  router.post(
    "/login",
    authRateLimit,
    zValidator("json", loginSchema),
    async (c) => {
      const body = c.req.valid("json");
      try {
        const payload = {
          email: body.email,
          password: body.password,
          ...(body.totpCode !== undefined && { totpCode: body.totpCode }),
        };
        const result = await svc.login(payload);
        setRefreshCookie(c, result.refreshToken);
        return c.json({ user: result.user, accessToken: result.accessToken });
      } catch (err) {
        if (err instanceof TotpRequiredError) {
          return c.json({ totpRequired: true }, 200);
        }
        throw err;
      }
    },
  );

  router.post("/refresh", async (c) => {
    const rawToken = getRefreshCookie(c);
    if (!rawToken) return c.json({ error: "No refresh token" }, 401);
    const result = await svc.refresh(rawToken);
    setRefreshCookie(c, result.newRefreshToken);
    return c.json({
      accessToken: result.accessToken,
      refreshToken: result.newRefreshToken,
    });
  });

  router.post("/logout", async (c) => {
    const rawToken = getRefreshCookie(c);
    if (rawToken) await svc.logout(rawToken);
    clearRefreshCookie(c);
    return c.json({ success: true });
  });

  router.get("/verify-email", async (c) => {
    const token = c.req.query("token");
    if (!token) return c.json({ error: "Missing token" }, 400);
    await svc.verifyEmail(token);
    return c.json({ success: true });
  });

  router.post(
    "/forgot-password",
    authRateLimit,
    zValidator("json", emailSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      await svc.requestPasswordReset(email);
      return c.json({ success: true });
    },
  );

  router.post(
    "/reset-password",
    zValidator("json", resetPasswordSchema),
    async (c) => {
      const { token, password } = c.req.valid("json");
      await svc.resetPassword(token, password);
      return c.json({ success: true });
    },
  );

  router.post(
    "/resend-verification-public",
    zValidator("json", emailSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      await svc.resendVerificationByEmail(email);
      return c.json({ success: true });
    },
  );

  // ── Authenticated ──────────────────────────────────────────────────────────

  router.use("/me", authnMiddleware);
  router.use("/me/*", authnMiddleware);
  router.use("/resend-verification", authnMiddleware);
  router.use("/totp/*", authnMiddleware);

  router.get("/me", (c) => {
    const userId = c.get("userId");
    if (!userId) throw unauthorized("Not authenticated");
    return c.json(svc.getUser(userId));
  });

  router.post("/resend-verification", async (c) => {
    const userId = c.get("userId");
    if (!userId) throw unauthorized("Not authenticated");
    await svc.resendVerification(userId);
    return c.json({ success: true });
  });

  router.post("/totp/setup", async (c) => {
    const userId = c.get("userId");
    if (!userId) throw unauthorized("Not authenticated");
    const result = await svc.setupTotp(userId);
    return c.json(result);
  });

  router.post("/totp/enable", zValidator("json", totpCodeSchema), (c) => {
    const userId = c.get("userId");
    if (!userId) throw unauthorized("Not authenticated");
    svc.enableTotp(userId, c.req.valid("json").code);
    return c.json({ success: true });
  });

  router.delete("/totp", zValidator("json", totpCodeSchema), (c) => {
    const userId = c.get("userId");
    if (!userId) throw unauthorized("Not authenticated");
    svc.disableTotp(userId, c.req.valid("json").code);
    return c.json({ success: true });
  });

  router.patch(
    "/me/settings",
    zValidator("json", settingsSchema),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) throw unauthorized("Not authenticated");
      const body = c.req.valid("json");
      const user = await svc.updateSettings(userId, body);
      return c.json({ user });
    },
  );

  return router;
}
