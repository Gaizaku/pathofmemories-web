import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {teamPublicationApi} from "./team-publication-api.mjs";
import {sha256} from "./discord-oauth.mjs";

async function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["001_registration.sql", "004_organizer_auth.sql", "005_team_drafts.sql", "006_team_publications.sql", "009_weekend_registration.sql"]) {
    sql.exec(readFileSync(new URL(name, import.meta.url), "utf8"));
  }
  const db = {prepare(query) { return {bind(...args) { return {
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return {results: sql.prepare(query).all(...args)}; },
    async run() { return {meta: sql.prepare(query).run(...args)}; },
  }; }}; }};
  const game = "where-winds-meet";
  sql.prepare("INSERT INTO games VALUES (?,?)").run(game, "Where Winds Meet");
  sql.prepare("INSERT INTO players (game_id,id,character_name,nickname) VALUES (?,?,?,?)").run(game, "current-player", "Current Player", "");
  sql.prepare("INSERT INTO organizers VALUES (?,?,1,?)").run("organizer", "Organizer", "now");
  sql.prepare("INSERT INTO organizer_sessions VALUES (?,?,?,?)").run(await sha256("session"), "organizer", "2099-01-01", "now");

  const eventIds = ["round-1", "round-2", "round-3", "round-4"];
  for (const [index, eventId] of eventIds.entries()) {
    const startsAt = `2026-10-0${index + 1}T12:00:00Z`;
    sql.prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)").run(game, eventId, startsAt, startsAt.slice(0, 10), "2026-10-05", "League", "open", 30);
    sql.prepare("INSERT INTO attendance_choices (game_id,event_id,player_id,status,preferred_role,note,updated_at,updated_by) VALUES (?,?,?,'attending',NULL,'',?,'member')").run(game, eventId, "current-player", "now");
    const board = index === 0
      ? {"current-player": {team: "ATTACK_1", loadout: "retired-loadout", tower: "TOP", towerPosition: 0}, "deleted-player": {team: "ATTACK_1", loadout: "", position: 1}}
      : {"current-player": {team: "ATTACK_1", loadout: "", tower: "TOP", towerPosition: 0}};
    sql.prepare("INSERT INTO team_drafts VALUES (?,?,?,?,?,?)").run(game, eventId, "organizer", 1, JSON.stringify(board), `2026-10-01T00:00:0${index}Z`);
  }

  const env = {GUILD_WAR_DB: db};
  const request = new Request(`https://preview.example/api/v2/games/${game}/war/announcements`, {
    method: "POST",
    headers: {Origin: "https://preview.example", Cookie: "pom_organizer_session=session", "Content-Type": "application/json"},
    body: JSON.stringify({eventIds}),
  });
  return {sql, env, request, eventIds};
}

test("announces the current normalized roster when a draft has stale player and loadout IDs", async () => {
  const f = await fixture();
  try {
    const response = await teamPublicationApi(f.request, f.env);
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.deepEqual(result.eventIds, f.eventIds);
    assert.equal(result.webhook, "unconfigured");

    const snapshot = JSON.parse(f.sql.prepare("SELECT snapshot_json FROM team_publications WHERE event_id='round-1'").get().snapshot_json);
    assert.deepEqual(snapshot.members.map(member => member.name), ["Current Player"]);
  } finally {
    f.sql.close();
  }
});
