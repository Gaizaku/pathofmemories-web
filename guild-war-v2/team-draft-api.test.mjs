import test from "node:test";
import assert from "node:assert/strict";
import {validDraft} from "./team-draft-api.mjs";

const placement = (team, suffix) => [suffix, {team, loadout: "L"+suffix}];
const draft = (entries) => ({revision: 1, board: Object.fromEntries(entries)});

test("accepts five players in a combat team", () => {
  assert.equal(validDraft(draft(Array.from({length: 5}, (_, index) => placement("ATTACK_1", String(index))))), true);
});

test("rejects a sixth player in a combat team", () => {
  assert.equal(validDraft(draft(Array.from({length: 6}, (_, index) => placement("ATTACK_1", String(index))))), false);
});

test("keeps Standby unrestricted and retains tactical limits", () => {
  assert.equal(validDraft(draft(Array.from({length: 30}, (_, index) => placement("STANDBY", String(index))))), true);
  assert.equal(validDraft(draft(["a","b","c","d"].map((id) => [id, {team: "DEFENSE_1", loadout: "L"+id, tower: "TOP"}]))), false);
});

test("accepts a saved team position and rejects an invalid one", () => {
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", position: 0}]])), true);
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", position: -1}]])), false);
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", position: 1.5}]])), false);
});

test("accepts a tower order only for an assigned tower", () => {
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", tower: "MID", towerPosition: 0}]])), true);
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", towerPosition: 0}]])), false);
  assert.equal(validDraft(draft([["a", {team: "ATTACK_1", loadout: "La", tower: "MID", towerPosition: 3}]])), false);
});
