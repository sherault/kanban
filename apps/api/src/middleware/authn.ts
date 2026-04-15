import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";
import type { HonoEnv } from "../types.js";

export const authnMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorized();
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set("userId", payload.sub);
    c.set("sessionId", payload.sessionId);
  } catch {
    throw unauthorized();
  }
  await next();
};
