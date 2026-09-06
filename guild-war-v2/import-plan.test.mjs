import test from "node:test";
import assert from "node:assert/strict";
import { bangkokWeekStart, buildImportPlan } from "./import-plan.mjs";

const sheet = (header, ...rows) => [header, ...rows];

test("derives the Monday of a Thai local week", () => {
  assert.equal(bangkokWeekStart("2026-09-05"), "2026-08-31");
  assert.equal(bangkokWeekStart("2026-09-07"), "2026-09-07");
});

test("builds parameterized statements and skips invalid loadouts", () => {
  const { report, statements } = buildImportPlan({
    players: sheet(["player_id", "character_name", "active"], ["P001", "Golf", true]),
    weapons: sheet(["weapon_id", "weapon_name", "active"], ["W001", "Sword", true], ["W002", "Spear", true]),
    loadouts: sheet(["loadout_id", "player_id", "role", "main_weapon_id", "sub_weapon_id", "active"], ["L001", "P001", "DPS", "W001", "W002", true], ["L002", "P404", "DPS", "W001", "W002", true]),
    events: sheet(["event_id", "date", "time", "war_type", "registration_status", "max_players"], ["E001", "2026-09-05", "19:30", "League", "OPEN", 30]),
    registrations: sheet(["registration_id", "event_id", "player_id", "preferred_role", "note", "submitted_at"], ["R001", "E001", "P001", "DPS", "", "2026-09-01T00:00:00Z"]),
    registrationRoles: sheet(["registration_id", "loadout_id"], ["R001", "L001"]),
  });

  assert.equal(report.issues.length, 1);
  assert.ok(statements.every((statement) => !statement.sql.includes("Golf")));
  assert.ok(statements.some((statement) => statement.params.includes("L001")));
  assert.ok(!statements.some((statement) => statement.params.includes("L002")));
  assert.ok(statements.some((statement) => statement.params.includes("2026-08-31")));
});
