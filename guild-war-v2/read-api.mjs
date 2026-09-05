// Isolated read-only handler. Not wired into the production Worker.
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

  if (!eventMatch && !playerMatch) return json({error: "not_found"}, 404);
  if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET"}});
  if (url.search) return json({error: "unsupported_query"}, 400);
  if (!env.GUILD_WAR_DB) return json({error: "database_not_configured"}, 503);

  try {
    if (eventMatch) {
      const week = bangkokWeek(now);
      const events = await query(env.GUILD_WAR_DB,
        "SELECT id, starts_at, local_date, war_type, status, capacity FROM events WHERE game_id = ? AND week_start = ? ORDER BY starts_at, id LIMIT 64",
        eventMatch[1], week
      );
      return json({gameId: eventMatch[1], weekStart: week, timeZone: "Asia/Bangkok", events});
    }

    const gameId = playerMatch[1];
    const players = await query(env.GUILD_WAR_DB,
      "SELECT id, character_name FROM players WHERE game_id = ? AND active = 1 ORDER BY character_name COLLATE NOCASE, id LIMIT 200",
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
