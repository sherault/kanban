import { describe, it, expect, vi } from "vitest";
import { WsRooms } from "../../features/ws/ws-rooms.js";
import type { WSContext } from "hono/ws";

function makeFakeWs(id: string) {
  return { send: vi.fn(), close: vi.fn(), _id: id } as unknown as WSContext;
}

describe("WsRooms", () => {
  it("broadcasts to subscribers of a room", () => {
    const rooms = new WsRooms();
    const ws = makeFakeWs("a");
    rooms.subscribe("project:1", ws);
    rooms.broadcast("project:1", {
      type: "task.deleted",
      payload: { id: "x", projectId: "1" },
    });
    expect(ws.send).toHaveBeenCalledOnce();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "task.deleted",
        payload: { id: "x", projectId: "1" },
      }),
    );
  });

  it("does not broadcast to subscribers of a different room", () => {
    const rooms = new WsRooms();
    const ws = makeFakeWs("a");
    rooms.subscribe("project:1", ws);
    rooms.broadcast("project:2", {
      type: "task.deleted",
      payload: { id: "x", projectId: "2" },
    });
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("broadcasts to multiple subscribers in the same room", () => {
    const rooms = new WsRooms();
    const ws1 = makeFakeWs("a");
    const ws2 = makeFakeWs("b");
    rooms.subscribe("org:1", ws1);
    rooms.subscribe("org:1", ws2);
    rooms.broadcast("org:1", {
      type: "project.deleted",
      payload: { id: "p1" },
    });
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it("stops broadcasting after unsubscribe", () => {
    const rooms = new WsRooms();
    const ws = makeFakeWs("a");
    rooms.subscribe("project:1", ws);
    rooms.unsubscribe(ws);
    rooms.broadcast("project:1", {
      type: "task.deleted",
      payload: { id: "x", projectId: "1" },
    });
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("unsubscribe removes ws from all rooms", () => {
    const rooms = new WsRooms();
    const ws = makeFakeWs("a");
    rooms.subscribe("org:1", ws);
    rooms.subscribe("project:1", ws);
    rooms.unsubscribe(ws);
    rooms.broadcast("org:1", {
      type: "project.deleted",
      payload: { id: "p1" },
    });
    rooms.broadcast("project:1", {
      type: "task.deleted",
      payload: { id: "x", projectId: "1" },
    });
    expect(ws.send).not.toHaveBeenCalled();
  });
});
