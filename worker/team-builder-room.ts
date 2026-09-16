import {DurableObject} from "cloudflare:workers";

type Placement = {
  team?: string;
  loadout?: string;
  jungle?: string;
  tower?: string;
  position?: number;
  towerPosition?: number;
};

type RoomState = {
  board: Record<string, Placement>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

function validBoard(value: unknown): value is Record<string, Placement> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 200) return false;
  return entries.every(([id, placement]) =>
    /^[A-Za-z0-9-]{1,64}$/.test(id)
    && !!placement
    && typeof placement === "object"
    && !Array.isArray(placement)
    && typeof (placement as Placement).team === "string"
    && typeof (placement as Placement).loadout === "string"
  );
}

export class TeamBuilderRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", {status: 426});
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);

    const stored = await this.ctx.storage.get<RoomState>("room");
    server.serializeAttachment({
      organizerId: request.headers.get("X-POM-Organizer-ID") || "",
      organizerName: request.headers.get("X-POM-Organizer-Name") || "Organizer",
    });
    server.send(JSON.stringify({
      type: "room_state",
      board: stored?.board || null,
      updatedAt: stored?.updatedAt || null,
      updatedBy: stored?.updatedBy || null,
      updatedByName: stored?.updatedByName || null,
    }));

    return new Response(null, {status: 101, webSocket: client});
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || message.length > 100000) return;

    let data: {type?: string; board?: unknown};
    try { data = JSON.parse(message); } catch { return; }
    if (data.type !== "board_update" || !validBoard(data.board)) return;

    const attachment = socket.deserializeAttachment() as {organizerId?: string; organizerName?: string} | null;
    const updatedBy = attachment?.organizerId || "";
    const updatedByName = attachment?.organizerName || "Organizer";
    if (!updatedBy) return;

    const next: RoomState = {
      board: data.board,
      updatedAt: new Date().toISOString(),
      updatedBy,
      updatedByName,
    };
    await this.ctx.storage.put("room", next);

    const payload = JSON.stringify({
      type: "room_update",
      board: next.board,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy,
      updatedByName: next.updatedByName,
    });
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === socket) continue;
      try { peer.send(payload); } catch {}
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    try { socket.close(); } catch {}
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    try { socket.close(); } catch {}
  }
}
