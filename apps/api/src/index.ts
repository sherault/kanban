import { config } from "dotenv";
console.log("Loading environment...");
config();

import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { db } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { createApp } from "./app.js";
import { WsRooms } from "./features/ws/ws-rooms.js";
import { wsRoutes } from "./features/ws/ws.routes.js";

// Environment variables are expected to be injected by the runtime (Docker, Turbo, etc.)
// We already loaded dotenv above as a fallback for direct node execution

async function start() {
  try {
    runMigrations();
  } catch (error) {
    console.error("Migration failed:", error);
  }

  const wsRooms = new WsRooms();
  const broadcast = wsRooms.broadcast.bind(wsRooms);
  const app = createApp(db, broadcast);

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  app.route("/ws", wsRoutes(db, wsRooms, upgradeWebSocket));

  const port = Number(process.env["API_PORT"] ?? process.env["PORT"] ?? 3001);
  const hostname = "0.0.0.0";

  const server = serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`API is now listening on http://${hostname}:${port}`);
  });

  injectWebSocket(server);
}

start().catch((err) => {
  console.error("FATAL: Failed to start API server:", err);
  process.exit(1);
});
