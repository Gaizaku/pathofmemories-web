import {activeOrganizer} from "./organizer-auth.mjs";

const routePattern = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/collaboration$/;
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});

export async function teamCollaborationApi(request, env) {
  const url = new URL(request.url);
  const match = routePattern.exec(url.pathname);
  if (!match) return null;
  if (request.method !== "GET") return json({error:"method_not_allowed"},405);
  if (request.headers.get("Origin") !== url.origin) return json({error:"origin_required"},403);

  const user = await activeOrganizer(env, request);
  if (!user) return json({error:"organizer_required"},401);

  const [, game, event] = match;
  try {
    const rows = await env.GUILD_WAR_DB.prepare(
      "SELECT revision,board_json,updated_at,organizer_id FROM team_drafts WHERE game_id=? AND event_id=? ORDER BY updated_at DESC LIMIT 1"
    ).bind(game,event).all();
    const row = rows.results?.[0];
    if (!row) return json({revision:0,board:{},updatedAt:null,organizerId:null});
    return json({
      revision: row.revision,
      board: JSON.parse(row.board_json),
      updatedAt: row.updated_at,
      organizerId: row.organizer_id,
      currentOrganizerId: user.id,
    });
  } catch {
    return json({error:"temporarily_unavailable"},503);
  }
}
