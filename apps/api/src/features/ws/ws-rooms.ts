import type { WSContext } from 'hono/ws'
import type { WsEvent } from '../../types.js'

export class WsRooms {
  private rooms = new Map<string, Set<WSContext>>()

  subscribe(room: string, ws: WSContext): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set())
    this.rooms.get(room)!.add(ws)
  }

  unsubscribe(ws: WSContext): void {
    for (const sockets of this.rooms.values()) {
      sockets.delete(ws)
    }
  }

  broadcast(room: string, event: WsEvent): void {
    const sockets = this.rooms.get(room)
    if (!sockets?.size) return
    const msg = JSON.stringify(event)
    for (const ws of sockets) {
      try {
        ws.send(msg)
      } catch {
        // client disconnected mid-broadcast — safe to ignore
      }
    }
  }
}
