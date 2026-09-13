import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {deletePlayerData} from "./player-management-api.mjs";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const file of ["001_registration.sql", "002_registration_claims.sql", "003_team_revisions.sql", "005_team_drafts.sql", "009_weekend_registration.sql"]) sql.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  sql.exec(`INSERT INTO games VALUES ('g','Game');
    INSERT INTO players (game_id,id,character_name) VALUES ('g','p1','Delete Me'),('g','p2','Keep Me');
    INSERT INTO weapons VALUES ('g','w1','Sword'),('g','w2','Spear');
    INSERT INTO loadouts (game_id,id,player_id,role,main_weapon_id,sub_weapon_id) VALUES ('g','l1','p1','DPS','w1','w2');
    INSERT INTO events VALUES ('g','e1','2026-09-12T19:30:00+07:00','2026-09-12','2026-09-07','League','open',30);
    INSERT INTO attendance_choices (game_id,event_id,player_id,status,updated_at,updated_by) VALUES ('g','e1','p1','attending','now','p1');
    INSERT INTO attendance_loadouts VALUES ('g','e1','p1','l1');
    INSERT INTO registration_claims VALUES ('g','e1','p1','hash','now','now');
    INSERT INTO regular_rules (game_id,player_id,enabled) VALUES ('g','p1',1);
    INSERT INTO regular_slots VALUES ('g','p1',6,'League');
    INSERT INTO weekly_absences (game_id,player_id,week_start) VALUES ('g','p1','2026-09-07');
    INSERT INTO member_preferences (game_id,player_id,token_hash,updated_at,operation_id) VALUES ('g','p1','hash','now','op');
    CREATE TABLE organizers (discord_user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
    INSERT INTO organizers VALUES ('org','Organizer',1);
    INSERT INTO team_revisions VALUES ('g','e1',1,'published','now','org',NULL);
    INSERT INTO team_assignments VALUES ('g','e1',1,'p1','ATTACK_1',NULL,NULL,'');
    INSERT INTO team_drafts VALUES ('g','e1','org',1,'{"p1":{"team":"ATTACK_1"},"p2":{"team":"STANDBY"}}','now');`);
  const db = {prepare(query) {return {bind(...args) {return {all: async () => ({results: sql.prepare(query).all(...args)}), run: async () => ({meta: sql.prepare(query).run(...args)})};}};}, async batch(statements) {sql.exec("BEGIN"); try {const result=[]; for (const statement of statements) result.push(await statement.run()); sql.exec("COMMIT"); return result;} catch (error) {sql.exec("ROLLBACK"); throw error;}}};
  return {sql, db};
}

test("permanently removes player-owned data and removes the player from live drafts", async () => {
  const f = fixture(); try {
    await deletePlayerData(f.db, "g", "p1", "org");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM players WHERE game_id='g' AND id='p1'").get().n, 0, "players");
    for (const table of ["loadouts", "attendance_choices", "attendance_loadouts", "registration_claims", "regular_rules", "regular_slots", "weekly_absences", "member_preferences", "team_assignments"]) {
      assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE game_id='g' AND player_id='p1'`).get().n, 0, table);
    }
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM players WHERE id='p2'").get().n, 1);
    assert.deepEqual(JSON.parse(f.sql.prepare("SELECT board_json FROM team_drafts").get().board_json), {p2: {team: "STANDBY"}});
  } finally { f.sql.close(); }
});
