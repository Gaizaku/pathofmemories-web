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
  sql.exec(readFileSync(new URL("013_war_schedule.sql", import.meta.url), "utf8"));
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
  const makeRequest = selectedIds => new Request(`https://preview.example/api/v2/games/${game}/war/announcements`, {
    method: "POST",
    headers: {Origin: "https://preview.example", Cookie: "pom_organizer_session=session", "Content-Type": "application/json"},
    body: JSON.stringify({eventIds: selectedIds}),
  });
  return {sql, env, request: makeRequest(eventIds), eventIds, post: selectedIds => teamPublicationApi(makeRequest(selectedIds), env)};
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

for (const count of [1, 3, 4]) {
  test(`publishes a bundle of ${count} selected rounds`, async () => {
    const f = await fixture();
    try {
      const eventIds = f.eventIds.slice(0, count);
      const response = await f.post(eventIds);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {eventIds, webhook: "unconfigured"});
      assert.deepEqual(f.sql.prepare("SELECT event_id FROM team_publications ORDER BY event_id").all().map(row => row.event_id), eventIds);
    } finally {
      f.sql.close();
    }
  });
}

test("invalid bundle selections return rounds_required without publishing", async () => {
  const f = await fixture();
  try {
    for (const eventIds of [undefined, null, "round-1", [], ["round-1", "round-2", "round-3", "round-4", "round-5"], ["round-1", "round-1"], ["round-1", "round-2", "round-3", "round-3"], ["invalid_id"], [7]]) {
      const response = await f.post(eventIds);
      assert.equal(response.status, 400, JSON.stringify(eventIds));
      assert.deepEqual(await response.json(), {error: "rounds_required"});
    }
    assert.equal(f.sql.prepare("SELECT count(*) AS count FROM team_publications").get().count, 0);
  } finally {
    f.sql.close();
  }
});

function usePausedWeekend(f) {
  for (const [index, eventId] of f.eventIds.entries()) {
    const time = ["12:30", "13:00", "13:30", "14:00"][index];
    f.sql.prepare("UPDATE events SET starts_at=?,local_date='2026-10-24',week_start='2026-10-19',war_type=? WHERE id=?")
      .run(`2026-10-24T${time}:00Z`, index === 0 ? "League" : "Rank", eventId);
  }
}

for (const count of [1, 3, 4]) {
  test(`rejects a paused round in a ${count}-round bundle before inserting any publications`, async () => {
    const f = await fixture();
    try {
      usePausedWeekend(f);
      const eventIds = [...f.eventIds.slice(1, count), "round-1"];
      const response = await f.post(eventIds);
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {error: "event_paused", eventId: "round-1"});
      assert.equal(f.sql.prepare("SELECT count(*) AS count FROM team_publications").get().count, 0);
    } finally {
      f.sql.close();
    }
  });
}

test("publishes the three active Rank rounds during the seeded League pause", async () => {
  const f = await fixture();
  try {
    usePausedWeekend(f);
    const response = await f.post(["round-2", "round-3", "round-4"]);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {eventIds: ["round-2", "round-3", "round-4"], webhook: "unconfigured"});
    assert.deepEqual(f.sql.prepare("SELECT event_id FROM team_publications ORDER BY event_id").all().map(row => row.event_id), ["round-2", "round-3", "round-4"]);
  } finally {
    f.sql.close();
  }
});
