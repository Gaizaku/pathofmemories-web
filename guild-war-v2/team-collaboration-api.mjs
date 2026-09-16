import {activeOrganizer} from "./organizer-auth.mjs";

const routePattern = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/collaboration$/;

export async function teamCollaborationApi(request, env) {
  const url = new URL(request.url);
  const match = routePattern.exec(url.pathname);
  if (!match) return null;
  if (request.method !== "GET" || request.headers.get("Upgrade") !== "websocket") {
    return new Response(JSON.stringify({error: "websocket_required"}), {
      status: 426,
      headers: {"Content-Type": "application/json", "Cache-Control": "no-store"},
    });
  }
  if (request.headers.get("Origin") !== url.origin) {
    return new Response(JSON.stringify({error: "origin_required"}), {
      status: 403,
      headers: {"Content-Type": "application/json", "Cache-Control": "no-store"},
    });
  }

  const user = await activeOrganizer(env, request);
  if (!user) {
    return new Response(JSON.stringify({error: "organizer_required"}), {
      status: 401,
      headers: {"Content-Type": "application/json", "Cache-Control": "no-store"},
    });
  }

  const [game, event] = [match[1], match[2]];
  const id = env.TEAM_BUILDER_ROOM.idFromName(game + ":" + event);
  const stub = env.TEAM_BUILDER_ROOM.get(id);
  const headers = new Headers(request.headers);
  headers.set("X-POM-Organizer-ID", user.id);
  headers.set("X-POM-Organizer-Name", user.displayName || "Organizer");
  return stub.fetch(new Request(request, {headers}));
}
