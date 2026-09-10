import {GAME, ensureWeekend, slotOf, rows} from './weekend.mjs';
export function bangkokWeek(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  return local.toISOString().slice(0, 10);
}

const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});

async function query(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  if (result.success === false) throw new Error("query_failed");
  return result.results;
}

export async function readApi(request, env, now = new Date()) {
  const url = new URL(request.url);
  const eventMatch = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events$/.exec(url.pathname);
  const playerMatch = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/players$/.exec(url.pathname);
  const registrationMatch = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/registrations$/.exec(url.pathname);

  if (!eventMatch && !playerMatch && !registrationMatch) return json({error: "not_found"}, 404);
  if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET"}});
  if (url.search) return json({error: "unsupported_query"}, 400);
  if (!env.GUILD_WAR_DB) return json({error: "database_not_configured"}, 503);

  try {
    if (eventMatch) {
      if(eventMatch[1]===GAME)return json({gameId:GAME,timeZone:'Asia/Bangkok',...await ensureWeekend(env.GUILD_WAR_DB,now)});
      const week = bangkokWeek(now);
      const events = await query(env.GUILD_WAR_DB,
        "SELECT id, starts_at, local_date, war_type, status, capacity FROM events WHERE game_id = ? AND week_start = ? ORDER BY starts_at, id LIMIT 64",
        eventMatch[1], week
      );
      return json({gameId: eventMatch[1], weekStart: week, timeZone: "Asia/Bangkok", events});
    }

    if (registrationMatch) {
      const [, gameId, eventId] = registrationMatch;
      const [event] = await query(env.GUILD_WAR_DB,
        "SELECT id, starts_at, local_date, war_type, status, capacity FROM events WHERE game_id = ? AND id = ?",
        gameId, eventId
      );
      if (!event) return json({error: "event_not_found"}, 404);

      const [registrations,chosenLoadouts,preferences,defaults,allLoadouts] = await Promise.all([
        query(env.GUILD_WAR_DB,"SELECT c.player_id, p.character_name, p.nickname, c.preferred_role, c.note, c.updated_at FROM attendance_choices c JOIN players p ON p.game_id = c.game_id AND p.id = c.player_id WHERE c.game_id = ? AND c.event_id = ? AND c.status = 'attending' ORDER BY c.updated_at, c.player_id LIMIT 200",gameId,eventId),
        query(env.GUILD_WAR_DB,"SELECT a.player_id, l.id, l.role, main.name AS main_weapon_name, sub.name AS sub_weapon_name FROM attendance_loadouts a JOIN loadouts l ON l.game_id = a.game_id AND l.id = a.loadout_id AND l.player_id = a.player_id AND l.active = 1 JOIN weapons main ON main.game_id = l.game_id AND main.id = l.main_weapon_id JOIN weapons sub ON sub.game_id = l.game_id AND sub.id = l.sub_weapon_id WHERE a.game_id = ? AND a.event_id = ? ORDER BY a.player_id, l.id LIMIT 500",gameId,eventId),
        gameId===GAME ? rows(env.GUILD_WAR_DB,'SELECT player_id,preferred_team FROM member_preferences WHERE game_id=?',gameId) : Promise.resolve([]),
        gameId===GAME ? rows(env.GUILD_WAR_DB,`SELECT p.id,p.character_name,p.nickname,m.* FROM member_preferences m JOIN players p ON p.game_id=m.game_id AND p.id=m.player_id WHERE m.game_id=? AND m.regular=1 AND p.active=1 AND NOT EXISTS (SELECT 1 FROM attendance_choices c WHERE c.game_id=m.game_id AND c.player_id=m.player_id AND c.event_id=?) AND NOT EXISTS (SELECT 1 FROM weekly_absences w JOIN events e ON e.game_id=w.game_id AND e.week_start=w.week_start WHERE e.id=? AND w.game_id=m.game_id AND w.player_id=m.player_id)`,gameId,eventId,eventId) : Promise.resolve([]),
        gameId===GAME ? rows(env.GUILD_WAR_DB,'SELECT l.id,l.player_id,l.role,a.name AS main_weapon_name,b.name AS sub_weapon_name FROM loadouts l JOIN weapons a ON a.game_id=l.game_id AND a.id=l.main_weapon_id JOIN weapons b ON b.game_id=l.game_id AND b.id=l.sub_weapon_id WHERE l.game_id=? AND l.active=1',gameId) : Promise.resolve([])
      ]);
      const grouped = new Map(registrations.map((registration) => [registration.player_id, {...registration, loadouts: []}]));
      for (const loadout of chosenLoadouts) grouped.get(loadout.player_id)?.loadouts.push(loadout);
      if(gameId===GAME) {
        for(const p of preferences)if(grouped.has(p.player_id))grouped.get(p.player_id).preferred_team=p.preferred_team;
        for(const p of defaults)if(event.status!=='cancelled'&&JSON.parse(p.slots_json).includes(slotOf(event))) {
          const ids=JSON.parse(p.loadouts_json);
          grouped.set(p.player_id,{player_id:p.player_id,character_name:p.character_name,nickname:p.nickname,preferred_role:p.preferred_role,note:'',attendance_status:'expected',preferred_team:p.preferred_team,loadouts:allLoadouts.filter(l=>l.player_id===p.player_id&&ids.includes(l.id))});
        }
      }
      return json({gameId, event, registrations: [...grouped.values()]});
    }

    const gameId = playerMatch[1];
    const players = await query(env.GUILD_WAR_DB,
      "SELECT id, character_name, nickname FROM players WHERE game_id = ? AND active = 1 ORDER BY character_name COLLATE NOCASE, id LIMIT 200",
      gameId
    );
    const loadouts = await query(env.GUILD_WAR_DB,
      "SELECT l.id, l.player_id, l.role, l.main_weapon_id, main.name AS main_weapon_name, l.sub_weapon_id, sub.name AS sub_weapon_name FROM loadouts l JOIN weapons main ON main.game_id = l.game_id AND main.id = l.main_weapon_id JOIN weapons sub ON sub.game_id = l.game_id AND sub.id = l.sub_weapon_id WHERE l.game_id = ? AND l.active = 1 ORDER BY l.player_id, l.id LIMIT 500",
      gameId
    );
    const grouped = new Map(players.map((player) => [player.id, {...player, loadouts: []}]));
    for (const loadout of loadouts) grouped.get(loadout.player_id)?.loadouts.push(loadout);
    return json({gameId, players: [...grouped.values()]});
  } catch {
    return json({error: "temporarily_unavailable"}, 503);
  }
}
