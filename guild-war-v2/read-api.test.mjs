import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {bangkokWeek, readApi} from "./read-api.mjs";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("./001_registration.sql", import.meta.url), "utf8"));
db.exec(`INSERT INTO games VALUES ("wwm","Test"),("other","Other");
INSERT INTO weapons VALUES ("wwm","W001","Sword"),("wwm","W002","Spear");
INSERT INTO players VALUES ("wwm","P001","Golf",1,1),("wwm","P002","Inactive",0,1);
INSERT INTO loadouts VALUES ("wwm","L001","P001","DPS","W001","W002",1);
INSERT INTO events VALUES ("wwm","one","2026-09-05T12:30:00Z","2026-09-05","2026-08-31","League","open",30);
INSERT INTO events VALUES ("wwm","old","2026-08-29T12:30:00Z","2026-08-29","2026-08-24","League","closed",30);
INSERT INTO events VALUES ("other","two","2026-09-05T12:30:00Z","2026-09-05","2026-08-31","League","open",30);
INSERT INTO attendance_choices VALUES ("wwm","one","P001","attending","DPS","ready",1,"2026-09-01T00:00:00Z","test");
INSERT INTO attendance_loadouts VALUES ("wwm","one","P001","L001");`);

const env = {GUILD_WAR_DB: {prepare(sql) {return {bind(...args) {return {async all() {return {success: true, results: db.prepare(sql).all(...args)};}};}};}};
const request = (path = "/api/v2/games/wwm/war/events", method = "GET") => new Request("https://test.invalid" + path, {method});
const now = new Date("2026-09-05T12:00:00Z");

test("Bangkok Monday boundary", () => {
  assert.equal(bangkokWeek(new Date("2026-09-06T16:59:59Z")), "2026-08-31");
  assert.equal(bangkokWeek(new Date("2026-09-06T17:00:00Z")), "2026-09-07");
});

test("only requested game and current week returned", async () => {
  const result = await readApi(request(), env, now);
  assert.deepEqual((await result.json()).events.map((event) => event.id), ["one"]);
});

test("returns active players with their owned loadouts", async () => {
  const result = await readApi(request("/api/v2/games/wwm/players"), env, now);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).players, [{
    id: "P001", character_name: "Golf",
    loadouts: [{id: "L001", player_id: "P001", role: "DPS", main_weapon_id: "W001", main_weapon_name: "Sword", sub_weapon_id: "W002", sub_weapon_name: "Spear"}],
  }]);
});

test("returns a round with registrations and chosen loadouts", async () => {
  const result = await readApi(request("/api/v2/games/wwm/war/events/one/registrations"), env, now);
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.event.id, "one");
  assert.deepEqual(body.registrations, [{
    player_id: "P001", character_name: "Golf", preferred_role: "DPS", note: "ready", updated_at: "2026-09-01T00:00:00Z",
    loadouts: [{player_id: "P001", id: "L001", role: "DPS", main_weapon_name: "Sword", sub_weapon_name: "Spear"}],
  }]);
});

test("unknown event returns 404", async () => {
  assert.equal((await readApi(request("/api/v2/games/wwm/war/events/missing/registrations"), env, now)).status, 404);
});

test("no binding fails closed", async () => assert.equal((await readApi(request(), {}, now)).status, 503));

test("writes rejected on all read endpoints", async () => {
  for (const path of ["/api/v2/games/wwm/war/events", "/api/v2/games/wwm/players", "/api/v2/games/wwm/war/events/one/registrations"]) {
    assert.equal((await readApi(request(path, "POST"), env, now)).status, 405);
  }
});

test("unknown path and arbitrary query are rejected", async () => {
  assert.equal((await readApi(request("/api/v2/players"), env, now)).status, 404);
  assert.equal((await readApi(request("/api/v2/games/wwm/players?all=true"), env, now)).status, 400);
});

test("SQL failure does not disclose details", async () => {
  const result = await readApi(request(), {GUILD_WAR_DB: {prepare() {throw Error("secret");}}}, now);
  assert.deepEqual(await result.json(), {error: "temporarily_unavailable"});
});
