import test from "node:test";
import assert from "node:assert/strict";
import {announcementGroupKey, discordAnnouncementEditRequest} from "./discord-announcement-sync.mjs";

test("announcement group keys are stable regardless of round selection order", () => {
  assert.equal(announcementGroupKey("game", ["E040", "E038", "E039", "E037"]), "game:E037,E038,E039,E040");
});

test("Discord announcement edits use the existing message endpoint", async () => {
  const request = discordAnnouncementEditRequest({
    channelId: "12345678901234567",
    messageId: "22345678901234567",
    token: "bot-token",
    payload: {embeds: [{title: "ประกาศรอบวอร์"}], components: []},
  });

  assert.equal(request.url, "https://discord.com/api/v10/channels/12345678901234567/messages/22345678901234567");
  assert.equal(request.options.method, "PATCH");
  assert.equal(request.options.headers.Authorization, "Bot bot-token");
  assert.deepEqual(JSON.parse(request.options.body), {embeds: [{title: "ประกาศรอบวอร์"}], components: []});
});
