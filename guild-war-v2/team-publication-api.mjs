import {activeOrganizer} from "./organizer-auth.mjs";
import {validDraft} from "./team-draft-api.mjs";
import {readApi} from "./read-api.mjs";
import {buildRoundEmbed, sendDiscordRoundBundle, isValidAnnouncementEventIds, attachPublicationUrls} from "./discord-announcement.mjs";
import {rememberDiscordAnnouncement} from "./discord-announcement-sync.mjs";

const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const discordTeams = [["ATTACK_1","🔴 ทีมบุก 1"],["ATTACK_2","🔴 ทีมบุก 2"],["ATTACK_3","🔴 ทีมบุก 3"],["DEFENSE_1","🔵 ทีมกัน 1"],["DEFENSE_2","🔵 ทีมกัน 2"],["FOREST","🟢 ป่า"],["STANDBY","⚪ สำรอง"]];
const literal = value => String(value || "").replace(/@/g,"@\u200b").replace(/[\r\n]/g," ").slice(0,180);
export function discordWebhookPayload(snapshot, publicationUrl) {
  return {username: "Path of Memories", embeds: [buildRoundEmbed(snapshot, publicationUrl, 1)]};
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

async function teamAnnouncementApi(request, env, url, game) {
  if (request.method !== "POST") return json({error: "method_not_allowed"}, 405);
  if (request.headers.get("Origin") !== url.origin) return json({error: "origin_required"}, 403);
  const user = await activeOrganizer(env, request);
  if (!user) return json({error: "organizer_required"}, 401);
  const raw = await request.text();
  if (raw.length > 2000) return json({error: "too_large"}, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return json({error: "invalid_request"}, 400); }
  if (!isValidAnnouncementEventIds(data?.eventIds)) return json({error: "four_rounds_required"}, 400);
  try {
    const db = env.GUILD_WAR_DB;
    // Use the latest shared draft, matching the board shown to collaborators.
    // Never fall back to an older publication when a round has no current draft.
    const currentRounds = [];
    for (const eventId of data.eventIds) {
      const draft = await db.prepare("SELECT revision,board_json FROM team_drafts WHERE game_id=? AND event_id=? ORDER BY updated_at DESC,revision DESC,organizer_id DESC LIMIT 1").bind(game, eventId).first();
      if (!draft) return json({error: "draft_missing", eventId}, 409);
      const rosterResponse = await readApi(new Request(url.origin + "/api/v2/games/" + game + "/war/events/" + eventId + "/registrations"), env);
      if (!rosterResponse.ok) return json({error: "roster_unavailable", eventId}, 503);
      const source = await rosterResponse.json();
      if (source.event.status === "cancelled") return json({error: "event_cancelled", eventId}, 409);
      let snapshot;
      try { snapshot = publicationSnapshot(JSON.parse(draft.board_json), source); }
      catch { return json({error: "draft_invalid", eventId}, 409); }
      const publicationId = crypto.randomUUID();
      const publishedAt = new Date().toISOString();
      await db.prepare("INSERT INTO team_publications (id,game_id,event_id,organizer_id,draft_revision,snapshot_json,published_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(game_id,event_id,organizer_id,draft_revision) DO UPDATE SET snapshot_json=excluded.snapshot_json,published_at=excluded.published_at").bind(publicationId, game, eventId, user.id, draft.revision, JSON.stringify(snapshot), publishedAt).run();
      const publication = await db.prepare("SELECT id,snapshot_json,published_at FROM team_publications WHERE game_id=? AND event_id=? AND organizer_id=? AND draft_revision=?").bind(game, eventId, user.id, draft.revision).first();
      if (!publication) return json({error: "publication_missing", eventIds: [eventId]}, 409);
      currentRounds.push({
        eventId,
        publicationId: publication.id,
        publishedAt: publication.published_at,
        snapshot: JSON.parse(publication.snapshot_json),
        publicationUrl: "",
      });
    }
    let origin = url.origin;
    try { origin = new URL(env.PUBLIC_ORIGIN || url.origin).origin; } catch {}
    const rounds = attachPublicationUrls(currentRounds, origin);
    const delivery = await sendDiscordRoundBundle(env, rounds, origin);
    const webhook = typeof delivery === "string" ? delivery : delivery.status;
    if (typeof delivery === "object" && delivery.messageId && env.DISCORD_CHANNEL_ID) {
      await rememberDiscordAnnouncement(db, {
        game,
        organizerId: user.id,
        eventIds: data.eventIds,
        channelId: env.DISCORD_CHANNEL_ID,
        messageId: delivery.messageId,
      });
    }
    return json({eventIds: data.eventIds, webhook});
  } catch {
    return json({error: "announcement_unavailable"}, 503);
  }
}
export async function teamPublicationApi(request, env) {
  const url = new URL(request.url);
  const announcementRoute = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/announcements$/.exec(url.pathname);
  if (announcementRoute) return teamAnnouncementApi(request, env, url, announcementRoute[1]);
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
