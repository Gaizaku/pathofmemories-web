import test from "node:test";
import assert from "node:assert/strict";
import { inspectImportSnapshot } from "./import-preview.mjs";

const sheet = (header, ...rows) => [header, ...rows];

test("reports unresolved source references instead of silently importing them", () => {
  const report = inspectImportSnapshot({
    players: sheet(["player_id"], ["P001"]),
    weapons: sheet(["weapon_id"], ["W001"], ["W002"]),
    loadouts: sheet(["loadout_id", "player_id", "main_weapon_id", "sub_weapon_id"], ["L001", "P404", "", "W002"]),
    events: sheet(["event_id"], ["E001"]),
    registrations: sheet(["registration_id", "event_id", "player_id"], ["R001", "E404", "P404"]),
    registrationRoles: sheet(["registration_id", "loadout_id"], ["R404", "L404"]),
  });

  assert.deepEqual(report.issues, [
    { entity: "loadout", id: "L001", reason: "missing_player" },
    { entity: "loadout", id: "L001", reason: "missing_main_weapon" },
    { entity: "registration", id: "R001", reason: "missing_event" },
    { entity: "registration", id: "R001", reason: "missing_player" },
    { entity: "registration_role", id: "R404", reason: "missing_registration" },
    { entity: "registration_role", id: "R404", reason: "missing_loadout" },
  ]);
});

test("accepts valid linked rows and counts populated source rows", () => {
  const report = inspectImportSnapshot({
    players: sheet(["player_id"], ["P001"]),
    weapons: sheet(["weapon_id"], ["W001"], ["W002"]),
    loadouts: sheet(["loadout_id", "player_id", "main_weapon_id", "sub_weapon_id"], ["L001", "P001", "W001", "W002"]),
    events: sheet(["event_id"], ["E001"]),
    registrations: sheet(["registration_id", "event_id", "player_id"], ["R001", "E001", "P001"]),
    registrationRoles: sheet(["registration_id", "loadout_id"], ["R001", "L001"]),
  });

  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.counts, { players: 1, weapons: 2, loadouts: 1, events: 1, registrations: 1, registrationRoles: 1 });
});
