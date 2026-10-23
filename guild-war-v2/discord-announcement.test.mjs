import test from "node:test";
import assert from "node:assert/strict";
import {announcementCustomId, buildAnnouncementPayload, isValidAnnouncementEventIds, parseAnnouncementCustomId} from "./discord-announcement.mjs";

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
    snapshot: {...snapshot,event:{startsAt:'2026-09-19T'+['19:30','20:00','20:30','21:00'][number-1]+':00+07:00',warType:number===1?'League':'Rank'}},
    publicationUrl: "https://pathofmemories.com/games/where-winds-meet/guild-war/published/E03" + number + "/publication",
  }));
  const payload = buildAnnouncementPayload(rounds, 1);
  assert.equal(payload.embeds[0].title, "ประกาศรอบวอร์");
  assert.match(payload.embeds[0].description, /รอบ 2 Rank/);
  assert.equal(payload.components[0].components.length, 5);
  assert.equal(payload.components[0].components[1].style, 3);
});

for (const count of [1, 2, 3, 4]) {
  test(`accepts ${count} selected rounds with matching buttons and selected publication`, () => {
    const eventIds = ["E037", "E038", "E039", "E040"].slice(0, count);
    const selectedIndex = count - 1;
    assert.equal(isValidAnnouncementEventIds(eventIds), true);
    assert.deepEqual(parseAnnouncementCustomId(`pom-war|${eventIds.join(",")}|${selectedIndex}`), {eventIds, selectedIndex});

    const rounds = eventIds.map((eventId, index) => ({
      eventId,
      snapshot: {...snapshot,event:{startsAt:'2026-09-19T'+['19:30','20:00','20:30','21:00'][index]+':00+07:00',warType:index===0?'League':'Rank'}, members: [{name: `Player ${index + 1}`, team: "ATTACK_1"}]},
      publicationUrl: `https://preview.example/published/${eventId}`,
    }));
    const payload = buildAnnouncementPayload(rounds, selectedIndex);
    const buttons = payload.components[0].components;
    assert.equal(buttons.length, count + 1);
    for (let index = 0; index < count; index += 1) {
      assert.equal(buttons[index].label, `รอบ ${index + 1}`);
      assert.equal(buttons[index].style, index === selectedIndex ? 3 : 1);
      assert.equal(buttons[index].custom_id, `pom-war|${eventIds.join(",")}|${index}`);
      assert.ok(buttons[index].custom_id.length <= 100);
    }
    const selectedUrl = `https://preview.example/published/${eventIds[selectedIndex]}`;
    assert.equal(buttons[count].style, 5);
    assert.equal(buttons[count].url, selectedUrl);
    assert.equal(payload.embeds[0].url, selectedUrl);
    assert.ok(payload.embeds[0].description.includes(selectedUrl));
    assert.equal(payload.embeds[0].fields[0].value, `• Player ${count}`);
  });
}

test("rejects empty, overfull, duplicate and malformed event selections", () => {
  for (const eventIds of [undefined, null, "E037", [], ["E037", "E038", "E039", "E040", "E041"], ["E037", "E037"], ["E037", "E038", "E039", "E039"], [""], ["bad_id"], [7], ["a".repeat(25)]]) {
    assert.equal(isValidAnnouncementEventIds(eventIds), false, JSON.stringify(eventIds));
  }
  for (const customId of ["pom-war||0", "pom-war|E037,E038,E039,E040,E041|0", "pom-war|E037,E037|0", "pom-war|E037,E038,E039,E039|0", "pom-war|bad_id|0", "other|E037|0", "pom-war|E037|0|extra"]) {
    assert.equal(parseAnnouncementCustomId(customId), null, customId);
  }
});

test("rejects malformed indexes and indexes outside the actual round selection", () => {
  for (const index of ["", " ", "-1", "4", "1.5", "NaN", "0x1", "1e0", "01", "+1", " 1", "1\n"]) {
    assert.equal(parseAnnouncementCustomId(`pom-war|E037,E038,E039,E040|${index}`), null, JSON.stringify(index));
  }
  assert.equal(parseAnnouncementCustomId("pom-war|E037|1"), null);
  assert.equal(parseAnnouncementCustomId("pom-war|E037,E038|2"), null);
  assert.equal(parseAnnouncementCustomId("pom-war|E037,E038,E039|3"), null);
});

test("accepts a 100-character custom id and rejects an overlong bundle", () => {
  const eventIds = ["a".repeat(24), "b".repeat(24), "c".repeat(24), "d".repeat(15)];
  const customId = `pom-war|${eventIds.join(",")}|3`;
  assert.equal(customId.length, 100);
  assert.equal(isValidAnnouncementEventIds(eventIds), true);
  assert.deepEqual(parseAnnouncementCustomId(customId), {eventIds, selectedIndex: 3});
  eventIds[3] += "d";
  assert.equal(isValidAnnouncementEventIds(eventIds), false);
  assert.equal(parseAnnouncementCustomId(`pom-war|${eventIds.join(",")}|0`), null);
});

test('three Rank rounds keep slot numbers 2–4 while button IDs keep their positional indexes',()=>{
  const rounds=['20:00','20:30','21:00'].map((time,index)=>({eventId:'wwm-2026-10-24-'+(index+2),snapshot:{event:{startsAt:'2026-10-24T'+time+':00+07:00',warType:'Rank'},members:[]},publicationUrl:'https://example.com/round/'+(index+2)}));
  const first=buildAnnouncementPayload(rounds,0);
  assert.deepEqual(first.components[0].components.slice(0,3).map(button=>button.label),['รอบ 2','รอบ 3','รอบ 4']);
  assert.match(first.embeds[0].description,/รอบ 2 Rank 20\.00/);
  assert.equal(parseAnnouncementCustomId(first.components[0].components[0].custom_id).selectedIndex,0);
  const last=buildAnnouncementPayload(rounds,2);
  assert.match(last.embeds[0].description,/รอบ 4 Rank 21\.00/);
  assert.equal(parseAnnouncementCustomId(last.components[0].components[2].custom_id).selectedIndex,2);
});
