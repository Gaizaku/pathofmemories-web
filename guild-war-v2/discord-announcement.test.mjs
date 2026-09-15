import test from "node:test";
import assert from "node:assert/strict";
import {announcementComponents, announcementCustomId, buildAnnouncementPayload, parseAnnouncementCustomId} from "./discord-announcement.mjs";

const snapshot = {
  event: {startsAt: "2026-09-19T12:30:00.000Z", warType: "League"},
  members: [{name: "Gaizaku", team: "ATTACK_1", role: "DPS"}],
};

test("round buttons stay within Discord custom id rules", () => {
  const ids = ["E037", "E038", "E039", "E040"];
  const parsed = parseAnnouncementCustomId(announcementCustomId(ids, 2));
  assert.deepEqual(parsed, {eventIds: ids, selectedIndex: 2});
  assert.ok(announcementCustomId(ids, 0).length <= 100);
});

test("announcement contains four buttons and the selected round link", () => {
  const rounds = [1, 2, 3, 4].map(number => ({
    eventId: "E03" + number,
    publicationId: "00000000-0000-0000-0000-00000000000" + number,
    snapshot,
    publicationUrl: "https://pathofmemories.com/games/where-winds-meet/guild-war/published/E03" + number + "/publication",
  }));
  const payload = buildAnnouncementPayload(rounds, 1);
  assert.equal(payload.embeds[0].title, "ประกาศรอบวอร์");
  assert.match(payload.embeds[0].description, /รอบ 2 League/);
  assert.equal(payload.components[0].components.length, 5);
  assert.equal(payload.components[0].components[1].style, 3);
});
