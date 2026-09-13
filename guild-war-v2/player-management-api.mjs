import {activeOrganizer} from "./organizer-auth.mjs";

const gamePattern = /^[a-z0-9-]{1,64}$/;
const playerPattern = /^[A-Za-z0-9-]{1,64}$/;
const json = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});

async function all(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  if (result.success === false) throw new Error("query_failed");
  return result.results;
}

export async function deletePlayerData(db, gameId, playerId, actorId) {
  const drafts = await all(db, "SELECT event_id, organizer_id, board_json FROM team_drafts WHERE game_id=?", gameId);
  const draftUpdates = [];
  for (const draft of drafts) {
    try {
      const board = JSON.parse(draft.board_json);
      if (!board || typeof board !== "object" || !(playerId in board)) continue;
      delete board[playerId];
      draftUpdates.push(db.prepare("UPDATE team_drafts SET board_json=?, updated_at=? WHERE game_id=? AND event_id=? AND organizer_id=?")
        .bind(JSON.stringify(board), new Date().toISOString(), gameId, draft.event_id, draft.organizer_id));
    } catch {
      // A malformed draft is ignored here; it is already unusable by the team builder.
    }
  }
  const auditEntity = playerId + ":%";
  await db.batch([
    ...draftUpdates,
    db.prepare("DELETE FROM registration_claims WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM attendance_loadouts WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM attendance_choices WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM weekly_absences WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM regular_slots WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM regular_rules WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM member_preferences WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM team_assignments WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM loadouts WHERE game_id=? AND player_id=?").bind(gameId, playerId),
    db.prepare("DELETE FROM audit_log WHERE game_id=? AND (actor_id=? OR entity_id=? OR entity_id LIKE ?)").bind(gameId, playerId, playerId, auditEntity),
    db.prepare("DELETE FROM players WHERE game_id=? AND id=?").bind(gameId, playerId),
    db.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)")
      .bind(gameId, actorId, "player_deleted", playerId, new Date().toISOString()),
  ]);
}

export async function playerManagementApi(request, env) {
  const url = new URL(request.url);
  const match = /^\/api\/v2\/games\/([a-z0-9-]{1,64})\/players\/manage$/.exec(url.pathname);
  if (!match) return null;
  if (!gamePattern.test(match[1])) return json({error: "not_found"}, 404);
  if (!["GET", "DELETE"].includes(request.method)) return new Response(null, {status: 405, headers: {Allow: "GET, DELETE"}});
  if (request.method === "DELETE" && request.headers.get("Origin") !== url.origin) return json({error: "invalid_origin"}, 403);
  try {
    const organizer = await activeOrganizer(env, request);
    if (!organizer) return json({error: "organizer_required"}, 401);
    const gameId = match[1];
    if (request.method === "GET") {
      const players = await all(env.GUILD_WAR_DB, `SELECT p.id,p.character_name,p.nickname,
        (SELECT count(*) FROM loadouts l WHERE l.game_id=p.game_id AND l.player_id=p.id AND l.active=1) AS loadout_count,
        (SELECT count(*) FROM attendance_choices c WHERE c.game_id=p.game_id AND c.player_id=p.id AND c.status='attending') AS registration_count
        FROM players p WHERE p.game_id=? AND p.active=1 ORDER BY p.character_name COLLATE NOCASE,p.id LIMIT 300`, gameId);
      return json({players: players.map((player) => ({id: player.id, characterName: player.character_name, nickname: player.nickname || "", loadoutCount: player.loadout_count, registrationCount: player.registration_count}))});
    }
    const raw = await request.text();
    if (raw.length > 300) return json({error: "too_large"}, 413);
    let data; try { data = JSON.parse(raw); } catch { data = null; }
    if (!data || !playerPattern.test(data.playerId) || typeof data.confirmation !== "string") return json({error: "invalid_request"}, 400);
    const [player] = await all(env.GUILD_WAR_DB, "SELECT id,character_name FROM players WHERE game_id=? AND id=? AND active=1", gameId, data.playerId);
    if (!player) return json({error: "player_not_found"}, 404);
    if (data.confirmation !== player.character_name) return json({error: "confirmation_mismatch"}, 400);
    await deletePlayerData(env.GUILD_WAR_DB, gameId, player.id, organizer.id);
    return json({deletedPlayerId: player.id});
  } catch {
    return json({error: "temporarily_unavailable"}, 503);
  }
}
