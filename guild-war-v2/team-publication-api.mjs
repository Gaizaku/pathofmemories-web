import {activeOrganizer} from "./organizer-auth.mjs";
import {validDraft} from "./team-draft-api.mjs";
import {readApi} from "./read-api.mjs";

const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const discordTeams = [["ATTACK_1","🔴 ทีมบุก 1"],["ATTACK_2","🔴 ทีมบุก 2"],["ATTACK_3","🔴 ทีมบุก 3"],["DEFENSE_1","🔵 ทีมกัน 1"],["DEFENSE_2","🔵 ทีมกัน 2"],["FOREST","🟢 ป่า"],["STANDBY","⚪ สำรอง"]];
const literal = value => String(value || "").replace(/@/g,"@\u200b").replace(/[\r\n]/g," ").slice(0,180);
export function discordWebhookPayload(snapshot, publicationUrl) {
  const fields=discordTeams.map(([team,name])=>{
    const members=snapshot.members.filter(member=>member.team===team);
    const value=members.length?members.map(member=>"• "+literal(member.name)+(member.role?" · "+literal(member.role):"")).join("\n"):"—";
    return {name:name+" · "+members.length+(team!=="STANDBY"?"/5":""),value:value.slice(0,1024),inline:true};
  });
  const starts=new Date(snapshot.event.startsAt).getTime();
  return {username:"Path of Memories",embeds:[{title:"⚔️ Guild War Team Ready",url:publicationUrl,description:(Number.isFinite(starts)?"<t:"+Math.floor(starts/1000)+":F>\n":"")+"[เปิดสรุปทีม]("+publicationUrl+")",color:0xC8A86B,fields,footer:{text:"Path of Memories · Guild War"}}]};
}
async function sendDiscordWebhook(env,snapshot,publicationUrl) {
  if(!env.DISCORD_WEBHOOK_URL)return "unconfigured";
  let webhook;try {webhook=new URL(env.DISCORD_WEBHOOK_URL);}catch{return "failed";}
  if(webhook.protocol!=="https:"||!/(^|\.)discord(?:app)?\.com$/i.test(webhook.hostname)||!webhook.pathname.startsWith("/api/webhooks/"))return "failed";
  try {const response=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(discordWebhookPayload(snapshot,publicationUrl))});return response.ok?"sent":"failed";}catch{return "failed";}
}
export function publicationSnapshot(board, source) {
  if (!validDraft({revision: 0, board}) || !Object.keys(board).length) throw new Error("invalid_board");
  const counts = {};
  const teamOrder = new Map(discordTeams.map(([team], index) => [team,index]));
  const members = Object.entries(board).sort(([,a],[,b]) =>
    (teamOrder.get(a.team) ?? 99) - (teamOrder.get(b.team) ?? 99) ||
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
  ).map(([id, placement]) => {
    const player = source.registrations.find(p => p.player_id === id);
    const loadout = player?.loadouts.find(l => l.id === placement.loadout);
    if (!player || (placement.loadout ? !loadout : player.loadouts.length)) throw new Error("roster_changed");
    counts[placement.team] = (counts[placement.team] || 0) + 1;
    if (placement.team !== "STANDBY" && counts[placement.team] > 5) throw new Error("squad_full");
    // Publish only team-facing fields, never registration notes or account identifiers.
    return {
      name: player.character_name, team: placement.team,
      role: loadout?.role || player.preferred_role || "",
      mainWeapon: loadout?.main_weapon_name || "", subWeapon: loadout?.sub_weapon_name || "",
      jungle: placement.jungle || "", tower: placement.tower || "", towerPosition: placement.towerPosition,
    };
  });
  return {event: {startsAt: source.event.starts_at, warType: source.event.war_type}, members,
    unassignedCount: source.registrations.filter(p => !Object.hasOwn(board, p.player_id)).length};
}

export async function teamPublicationApi(request, env) {
  const url = new URL(request.url);
  const route = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/publications(?:\/([a-f0-9-]{36}))?$/.exec(url.pathname);
  if (!route) return null;
  const [,game,event,id] = route;
  if ((id && request.method !== "GET") || (!id && request.method !== "POST")) return json({error: "method_not_allowed"}, 405);
  if (!id && request.headers.get("Origin") !== url.origin) return json({error: "origin_required"}, 403);
  try {
    const db = env.GUILD_WAR_DB;
    if (id) {
      const row = await db.prepare("SELECT snapshot_json,published_at FROM team_publications WHERE game_id=? AND event_id=? AND id=?").bind(game,event,id).first();
      return row ? json({id, publishedAt: row.published_at, ...JSON.parse(row.snapshot_json)}) : json({error: "not_found"},404);
    }
    const user = await activeOrganizer(env,request);
    if (!user) return json({error: "organizer_required"},401);
    const raw = await request.text();
    if (raw.length > 1000) return json({error: "too_large"},413);
    let data; try {data = JSON.parse(raw);} catch {return json({error: "invalid_request"},400);}
    if (!Number.isSafeInteger(data?.revision) || data.revision < 1) return json({error: "save_draft_first"},400);
    const existing = await db.prepare("SELECT id FROM team_publications WHERE game_id=? AND event_id=? AND organizer_id=? AND draft_revision=?").bind(game,event,user.id,data.revision).first();
    if (existing) return json({id: existing.id,webhook:"already_published"});
    const draft = await db.prepare("SELECT board_json FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=? AND revision=?").bind(game,event,user.id,data.revision).first();
    if (!draft) return json({error: "draft_conflict"},409);
    const rosterResponse = await readApi(new Request(url.origin+"/api/v2/games/"+game+"/war/events/"+event+"/registrations"),env);
    if (!rosterResponse.ok) return json({error: "roster_unavailable"},503);
    const source = await rosterResponse.json();
    if (source.event.status === "cancelled") return json({error: "event_cancelled"},409);
    let snapshot;
    try {snapshot = publicationSnapshot(JSON.parse(draft.board_json),source);}
    catch {return json({error: "review_board"},409);}
    const publicationId = crypto.randomUUID();
    // Recheck the draft revision in the insert; retries reuse the same publication.
    await db.prepare("INSERT INTO team_publications (id,game_id,event_id,organizer_id,draft_revision,snapshot_json,published_at) SELECT ?,game_id,event_id,organizer_id,revision,?,? FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=? AND revision=? ON CONFLICT(game_id,event_id,organizer_id,draft_revision) DO NOTHING")
      .bind(publicationId,JSON.stringify(snapshot),new Date().toISOString(),game,event,user.id,data.revision).run();
    const published = await db.prepare("SELECT id FROM team_publications WHERE game_id=? AND event_id=? AND organizer_id=? AND draft_revision=?").bind(game,event,user.id,data.revision).first();
    if(!published)return json({error: "draft_conflict"},409);
    let origin=url.origin;try{origin=new URL(env.PUBLIC_ORIGIN||url.origin).origin;}catch{}
    const webhook=await sendDiscordWebhook(env,snapshot,origin+"/games/where-winds-meet/guild-war/published/"+event+"/"+published.id);
    return json({id: published.id,webhook});
  } catch {return json({error: "publication_unavailable"},503);}
}
