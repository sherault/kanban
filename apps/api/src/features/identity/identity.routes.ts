import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { AppDb, HonoEnv } from "../../types.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";
import { IdentityService, TotpRequiredError } from "./identity.service.js";
import { unauthorized } from "../../lib/errors.js";

const COOKIE_NAME = KB_REFRESH_TOKEN_COOKIE;
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const totpCodeSchema = z.object({
  code: z.string().length(6),
});

const emailSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

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
        setCookie(c, COOKIE_NAME, result.refreshToken, {
          httpOnly: true,
          sameSite: "Strict",
          secure: process.env["NODE_ENV"] === "production",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        });
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
    const rawToken = getCookie(c, COOKIE_NAME);
    if (!rawToken) return c.json({ error: "No refresh token" }, 401);
    const result = await svc.refresh(rawToken);
    setCookie(c, COOKIE_NAME, result.newRefreshToken, {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return c.json({
      accessToken: result.accessToken,
      refreshToken: result.newRefreshToken,
    });
  });

  router.post("/logout", async (c) => {
    const rawToken = getCookie(c, COOKIE_NAME);
    if (rawToken) await svc.logout(rawToken);
    deleteCookie(c, COOKIE_NAME, { path: "/" });
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
    zValidator(
      "json",
      z.object({
        maxOpenPanels: z.number().min(1).max(10).optional(),
        enableNotifications: z.boolean().optional(),
        maxNotifications: z.number().min(1).max(5).optional(),
        notificationDuration: z.number().min(1).max(30).optional(),
      }),
    ),
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
