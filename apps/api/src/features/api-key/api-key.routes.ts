import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppDb, HonoEnv } from "../../types.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { ApiKeyService } from "./api-key.service.js";

const createKeySchema = z.object({
  label: z.string().min(1).max(100),
});

export function apiKeyRoutes(db: AppDb): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();
  const svc = new ApiKeyService(db);

  router.use("*", authnMiddleware);

  router.get("/api-keys", (c) => c.json(svc.listKeys(c.get("userId"))));

  router.post("/api-keys", zValidator("json", createKeySchema), async (c) => {
    const { label } = c.req.valid("json");
    const key = await svc.createKey(c.get("userId"), label);
    return c.json(key, 201);
  });

  router.delete("/api-keys/:keyId", async (c) => {
    const keyId = c.req.param("keyId");
    const userId = c.get("userId");
    await svc.revokeKey(userId, keyId);
    return c.json({ success: true });
  });

  return router;
}
