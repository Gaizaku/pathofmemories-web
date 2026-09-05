import {createClaimToken, hashClaimToken, hasMatchingClaim} from "./registration-token.mjs";

const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});

async function all(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  if (result.success === false) throw new Error("query_failed");
  return result.results;
}

function validPayload(value) {
  if (!value || typeof value !== "object") return null;
  const {playerId, preferredRole = null, note = "", loadoutIds = [], claimToken = null} = value;
  if (typeof playerId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(playerId)) return null;
  if (preferredRole !== null && (typeof preferredRole !== "string" || preferredRole.length > 32)) return null;
  if (typeof note !== "string" || note.length > 500) return null;
  if (!Array.isArray(loadoutIds) || loadoutIds.length > 8 || new Set(loadoutIds).size !== loadoutIds.length) return null;
  if (!loadoutIds.every((id) => typeof id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(id))) return null;
  if (claimToken !== null && (typeof claimToken !== "string" || claimToken.length > 128)) return null;
  return {playerId, preferredRole, note, loadoutIds, claimToken};
}

export async function registrationApi(request, env) {
  const url = new URL(request.url);
  const match = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/registrations$/.exec(url.pathname);
  if (!match) return null;
  if (request.method !== "POST") return new Response(null, {status: 405, headers: {Allow: "GET, POST"}});
  if (!env.GUILD_WAR_DB) return json({error: "database_not_configured"}, 503);

  let payload;
  try { payload = validPayload(await request.json()); } catch { payload = null; }
  if (!payload) return json({error: "invalid_request"}, 400);

  const [, gameId, eventId] = match;
  const now = new Date().toISOString();
  try {
    const [event] = await all(env.GUILD_WAR_DB,
      "SELECT status FROM events WHERE game_id = ? AND id = ?", gameId, eventId);
    if (!event) return json({error: "event_not_found"}, 404);
    if (event.status !== "open") return json({error: "registration_closed"}, 409);

    const [player] = await all(env.GUILD_WAR_DB,
      "SELECT id FROM players WHERE game_id = ? AND id = ? AND active = 1", gameId, payload.playerId);
    if (!player) return json({error: "player_not_found"}, 404);

    if (payload.loadoutIds.length) {
      const marks = payload.loadoutIds.map(() => "?").join(",");
      const owned = await all(env.GUILD_WAR_DB,
        `SELECT id FROM loadouts WHERE game_id = ? AND player_id = ? AND active = 1 AND id IN (${marks})`,
        gameId, payload.playerId, ...payload.loadoutIds);
      if (owned.length !== payload.loadoutIds.length) return json({error: "invalid_loadout"}, 400);
    }

    const [existingClaim] = await all(env.GUILD_WAR_DB,
      "SELECT token_hash FROM registration_claims WHERE game_id = ? AND event_id = ? AND player_id = ?",
      gameId, eventId, payload.playerId);

    const claimToken = existingClaim ? payload.claimToken : createClaimToken();
    if (existingClaim && !(await hasMatchingClaim(claimToken, existingClaim.token_hash))) {
      return json({error: "claim_required"}, 409);
    }

    const statements = [
      env.GUILD_WAR_DB.prepare(
        "INSERT INTO attendance_choices (game_id, event_id, player_id, status, preferred_role, note, updated_at, updated_by) VALUES (?, ?, ?, 'attending', ?, ?, ?, 'guest') ON CONFLICT(game_id, event_id, player_id) DO UPDATE SET status = 'attending', preferred_role = excluded.preferred_role, note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
      ).bind(gameId, eventId, payload.playerId, payload.preferredRole, payload.note, now),
      env.GUILD_WAR_DB.prepare(
        "DELETE FROM attendance_loadouts WHERE game_id = ? AND event_id = ? AND player_id = ?"
      ).bind(gameId, eventId, payload.playerId),
      ...payload.loadoutIds.map((loadoutId) => env.GUILD_WAR_DB.prepare(
        "INSERT INTO attendance_loadouts (game_id, event_id, player_id, loadout_id) VALUES (?, ?, ?, ?)"
      ).bind(gameId, eventId, payload.playerId, loadoutId)),
    ];

    if (existingClaim) {
      statements.push(env.GUILD_WAR_DB.prepare(
        "UPDATE registration_claims SET last_used_at = ? WHERE game_id = ? AND event_id = ? AND player_id = ?"
      ).bind(now, gameId, eventId, payload.playerId));
    } else {
      statements.push(env.GUILD_WAR_DB.prepare(
        "INSERT INTO registration_claims (game_id, event_id, player_id, token_hash, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(gameId, eventId, payload.playerId, await hashClaimToken(claimToken), now, now));
    }

    await env.GUILD_WAR_DB.batch(statements);
    return json({playerId: payload.playerId, eventId, claimToken: existingClaim ? undefined : claimToken}, existingClaim ? 200 : 201);
  } catch {
    return json({error: "temporarily_unavailable"}, 503);
  }
}
