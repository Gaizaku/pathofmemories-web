import {activeOrganizer} from "./organizer-auth.mjs";

const teams = new Set(["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"]);
const day = /^\d{4}-\d{2}-\d{2}$/;
const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});

async function all(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  if (result.success === false) throw new Error("query_failed");
  return result.results;
}

function text(value, limit = 64) {
  return value === null || value === undefined || value === "" ? null : typeof value === "string" && value.length <= limit ? value : undefined;
}

function regularPayload(value) {
  if (!value || typeof value !== "object") return null;
  const playerId = text(value.playerId);
  const startsOn = text(value.startsOn, 10), endsOn = text(value.endsOn, 10), pausedUntil = text(value.pausedUntil, 10);
  const defaultRole = text(value.defaultRole, 32), defaultLoadoutId = text(value.defaultLoadoutId), preferredTeam = text(value.preferredTeam, 32);
  if (!playerId || !Array.isArray(value.slots) || typeof value.enabled !== "boolean") return null;
  if ([startsOn, endsOn, pausedUntil].some((item) => item !== null && (!item || !day.test(item)))) return null;
  if (startsOn && endsOn && endsOn < startsOn) return null;
  if (preferredTeam && !teams.has(preferredTeam)) return null;
  const slots = value.slots.map((slot) => ({weekday: Number(slot?.weekday), warType: text(slot?.warType, 32)}));
  if (slots.length > 14 || slots.some((slot) => !Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 || !slot.warType)
    || new Set(slots.map((slot) => slot.weekday + ":" + slot.warType)).size !== slots.length) return null;
  return {playerId, enabled: value.enabled, startsOn, endsOn, pausedUntil, defaultRole, defaultLoadoutId, preferredTeam, slots};
}

function absencePayload(value) {
  if (!value || typeof value !== "object") return null;
  const playerId = text(value.playerId), weekStart = text(value.weekStart, 10), reason = text(value.reason, 240) ?? "";
  if (!playerId || !weekStart || !day.test(weekStart) || typeof value.absent !== "boolean" || reason === undefined) return null;
  return {playerId, weekStart, absent: value.absent, reason};
}

export async function regularsApi(request, env) {
  const url = new URL(request.url);
  const regularMatch = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/regulars$/.exec(url.pathname);
  const absenceMatch = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/regular-absences$/.exec(url.pathname);
  if (!regularMatch && !absenceMatch) return null;
  if (!["GET", "PUT"].includes(request.method)) return new Response(null, {status: 405, headers: {Allow: "GET, PUT"}});
  if (request.method === "PUT" && request.headers.get("Origin") !== url.origin) return json({error: "invalid_origin"}, 403);
  try {
    const organizer = await activeOrganizer(env, request);
    if (!organizer) return json({error: "organizer_required"}, 401);
    const gameId = (regularMatch || absenceMatch)[1];
    if (regularMatch) {
      if (request.method === "GET") {
        const [players, rules, slots] = await Promise.all([
          all(env.GUILD_WAR_DB, "SELECT id, character_name, nickname FROM players WHERE game_id=? AND active=1 ORDER BY character_name COLLATE NOCASE, id LIMIT 200", gameId),
          all(env.GUILD_WAR_DB, "SELECT player_id, enabled, starts_on, ends_on, default_role, default_loadout_id, preferred_team, paused_until FROM regular_rules WHERE game_id=?", gameId),
          all(env.GUILD_WAR_DB, "SELECT player_id, weekday, war_type FROM regular_slots WHERE game_id=? ORDER BY player_id, weekday, war_type", gameId),
        ]);
        const byPlayer = new Map(rules.map((rule) => [rule.player_id, {...rule, slots: []}]));
        for (const slot of slots) byPlayer.get(slot.player_id)?.slots.push({weekday: slot.weekday, warType: slot.war_type});
        return json({regulars: players.map((player) => ({playerId: player.id, characterName: player.character_name, nickname: player.nickname || "", ...(byPlayer.get(player.id) || {enabled: 0, slots: []})}))});
      }
      let data; try { data = regularPayload(await request.json()); } catch { data = null; }
      if (!data) return json({error: "invalid_regular"}, 400);
      const [player] = await all(env.GUILD_WAR_DB, "SELECT id FROM players WHERE game_id=? AND id=? AND active=1", gameId, data.playerId);
      if (!player) return json({error: "player_not_found"}, 404);
      if (data.defaultLoadoutId) {
        const [loadout] = await all(env.GUILD_WAR_DB, "SELECT id FROM loadouts WHERE game_id=? AND player_id=? AND id=? AND active=1", gameId, data.playerId, data.defaultLoadoutId);
        if (!loadout) return json({error: "invalid_loadout"}, 400);
      }
      const now = new Date().toISOString();
      await env.GUILD_WAR_DB.batch([
        env.GUILD_WAR_DB.prepare("INSERT INTO regular_rules (game_id,player_id,enabled,starts_on,ends_on,revision,default_role,default_loadout_id,preferred_team,paused_until) VALUES (?,?,?,?,?,1,?,?,?,?) ON CONFLICT(game_id,player_id) DO UPDATE SET enabled=excluded.enabled, starts_on=excluded.starts_on, ends_on=excluded.ends_on, default_role=excluded.default_role, default_loadout_id=excluded.default_loadout_id, preferred_team=excluded.preferred_team, paused_until=excluded.paused_until, revision=regular_rules.revision+1").bind(gameId,data.playerId,data.enabled?1:0,data.startsOn,data.endsOn,data.defaultRole,data.defaultLoadoutId,data.preferredTeam,data.pausedUntil),
        env.GUILD_WAR_DB.prepare("DELETE FROM regular_slots WHERE game_id=? AND player_id=?").bind(gameId,data.playerId),
        ...data.slots.map((slot) => env.GUILD_WAR_DB.prepare("INSERT INTO regular_slots (game_id,player_id,weekday,war_type) VALUES (?,?,?,?)").bind(gameId,data.playerId,slot.weekday,slot.warType)),
        env.GUILD_WAR_DB.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)").bind(gameId,organizer.id,"regular_updated",data.playerId,now),
      ]);
      return json({ok: true});
    }
    const weekStart = url.searchParams.get("weekStart");
    if (request.method === "GET") {
      if (!weekStart || !day.test(weekStart) || [...url.searchParams.keys()].some((key) => key !== "weekStart")) return json({error: "invalid_week"}, 400);
      const absences = await all(env.GUILD_WAR_DB, "SELECT player_id, week_start, reason FROM weekly_absences WHERE game_id=? AND week_start=?", gameId, weekStart);
      return json({weekStart, absences: absences.map((item) => ({playerId: item.player_id, weekStart: item.week_start, reason: item.reason || ""}))});
    }
    let data; try { data = absencePayload(await request.json()); } catch { data = null; }
    if (!data) return json({error: "invalid_absence"}, 400);
    const now = new Date().toISOString();
    if (data.absent) await env.GUILD_WAR_DB.prepare("INSERT INTO weekly_absences (game_id,player_id,week_start,reason,updated_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(game_id,player_id,week_start) DO UPDATE SET reason=excluded.reason, updated_at=excluded.updated_at, updated_by=excluded.updated_by").bind(gameId,data.playerId,data.weekStart,data.reason,now,organizer.id).run();
    else await env.GUILD_WAR_DB.prepare("DELETE FROM weekly_absences WHERE game_id=? AND player_id=? AND week_start=?").bind(gameId,data.playerId,data.weekStart).run();
    await env.GUILD_WAR_DB.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)").bind(gameId,organizer.id,data.absent?"weekly_absence_set":"weekly_absence_cleared",data.playerId+":"+data.weekStart,now).run();
    return json({ok: true});
  } catch {
    return json({error: "temporarily_unavailable"}, 503);
  }
}
