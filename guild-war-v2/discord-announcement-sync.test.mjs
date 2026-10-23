import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {announcementGroupKey, discordAnnouncementEditRequest, rememberDiscordAnnouncement, scheduleDiscordAnnouncementSync, syncDiscordAnnouncements} from "./discord-announcement-sync.mjs";
import {discordInteractionApi, findAnnouncementOwner} from "./discord-interactions.mjs";

test("announcement group keys are stable regardless of round selection order", () => {
  assert.equal(announcementGroupKey("game", ["E040", "E038", "E039", "E037"]), "game:E037,E038,E039,E040");
  assert.equal(announcementGroupKey("game", ["E040", "E038", "E039"]), "game:E038,E039,E040");
  assert.equal(announcementGroupKey("game", ["E040"]), "game:E040");
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

function fixture(game = "game") {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["001_registration.sql", "004_organizer_auth.sql", "005_team_drafts.sql", "006_team_publications.sql", "012_discord_announcements.sql"]) {
    sql.exec(readFileSync(new URL(name, import.meta.url), "utf8"));
  }
  const db = {
    prepare(query) { return {bind(...args) { return {
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return {results: sql.prepare(query).all(...args)}; },
      async run() { return {meta: sql.prepare(query).run(...args)}; },
    }; }}; },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
  sql.prepare("INSERT INTO games VALUES (?, 'Game')").run(game);
  if (game === "where-winds-meet") {
    for (const name of ["009_weekend_registration.sql", "013_war_schedule.sql"]) {
      sql.exec(readFileSync(new URL(name, import.meta.url), "utf8"));
    }
  }
  sql.prepare("INSERT INTO players (game_id,id,character_name) VALUES (?,'player','Current Player')").run(game);
  sql.exec("INSERT INTO organizers VALUES ('owner','Owner',1,'now'),('collaborator','Collaborator',1,'now')");
  const eventIds = ["E037", "E038", "E039", "E040"];
  for (const [index, eventId] of eventIds.entries()) {
    const startsAt = `2026-10-24T${13 + index}:00:00Z`;
    sql.prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)").run(game, eventId, startsAt, "2026-10-24", "2026-10-19", "Rank", "open", 30);
    sql.prepare("INSERT INTO attendance_choices (game_id,event_id,player_id,status,note,updated_at,updated_by) VALUES (?,?,'player','attending','','now','member')").run(game, eventId);
    sql.prepare("INSERT INTO team_drafts VALUES (?,?,?,?,?,?)").run(game, eventId, "collaborator", 2, JSON.stringify({player: {team: "ATTACK_1", loadout: ""}}), "2026-10-23T12:00:00Z");
    for (const organizer of ["owner", "collaborator"]) {
      const snapshot = {event: {startsAt, warType: "Rank"}, members: [{name: `${organizer} ${eventId}`, team: "ATTACK_1"}]};
      sql.prepare("INSERT INTO team_publications VALUES (?,?,?,?,?,?,?)").run(`${organizer}-${eventId}`, game, eventId, organizer, 1, JSON.stringify(snapshot), organizer === "owner" ? "2026-10-21T12:00:00Z" : "2026-10-22T12:00:00Z");
    }
  }
  const env = {GUILD_WAR_DB: db, DISCORD_BOT_TOKEN: "test-token", DISCORD_CHANNEL_ID: "12345678901234567", PUBLIC_ORIGIN: "https://preview.example"};
  return {sql, db, env, eventIds};
}

async function buttonRequest(env, eventIds, selectedIndex) {
  const keys = await crypto.subtle.generateKey({name: "Ed25519"}, true, ["sign", "verify"]);
  env.DISCORD_PUBLIC_KEY = Buffer.from(await crypto.subtle.exportKey("raw", keys.publicKey)).toString("hex");
  const body = JSON.stringify({type: 3, channel_id: env.DISCORD_CHANNEL_ID, message: {id: "22345678901234567"}, data: {custom_id: `pom-war|${eventIds.join(",")}|${selectedIndex}`}});
  const timestamp = "1792756800";
  const signature = Buffer.from(await crypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(timestamp + body))).toString("hex");
  return new Request("https://preview.example/api/discord/interactions", {method: "POST", headers: {"X-Signature-Ed25519": signature, "X-Signature-Timestamp": timestamp}, body});
}

for (const count of [1, 3, 4]) {
  test(`remembers and live-syncs ${count} rounds while preserving the message owner's publications`, async t => {
    const game = count === 3 ? "where-winds-meet" : "game";
    const f = fixture(game);
    const deliveries = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      deliveries.push({url, options, payload: JSON.parse(options.body)});
      return Response.json({id: "22345678901234567"});
    });
    try {
      const eventIds = f.eventIds.slice(0, count);
      const key = await rememberDiscordAnnouncement(f.db, {game, organizerId: "owner", eventIds: [...eventIds].reverse(), channelId: f.env.DISCORD_CHANNEL_ID, messageId: "22345678901234567"});
      const remembered = f.sql.prepare("SELECT * FROM discord_announcements WHERE announcement_key=?").get(key);
      assert.equal(key, `${game}:${eventIds.join(",")}`);
      assert.deepEqual(JSON.parse(remembered.event_ids_json), eventIds);
      assert.equal(await findAnnouncementOwner(f.db, game, {channel_id: f.env.DISCORD_CHANNEL_ID, message: {id: remembered.message_id}}, eventIds), "owner");
      const waiting = [];
      scheduleDiscordAnnouncementSync({db: f.db, env: f.env, game, eventId: eventIds[0], organizerId: "collaborator", origin: "https://preview.example", executionContext: {waitUntil(promise) { waiting.push(promise); }}});
      await Promise.all(waiting);

      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].url, "https://discord.com/api/v10/channels/12345678901234567/messages/22345678901234567");
      assert.equal(deliveries[0].options.method, "PATCH");
      assert.equal(deliveries[0].payload.components[0].components.length, count + 1);
      assert.equal(deliveries[0].payload.embeds[0].fields[0].value, "• Current Player");
      assert.equal(deliveries[0].payload.embeds[0].url, "https://preview.example/games/where-winds-meet/guild-war/published/E037/owner-E037");
      const synced = f.sql.prepare("SELECT * FROM discord_announcements WHERE announcement_key=?").get(key);
      assert.equal(synced.change_version, 1);
      assert.equal(synced.claimed_version, 1);
      assert.equal(synced.synced_version, 1);
      assert.equal(synced.last_sync_status, "sent");
      const owner = JSON.parse(f.sql.prepare("SELECT snapshot_json FROM team_publications WHERE id='owner-E037'").get().snapshot_json);
      const collaborator = JSON.parse(f.sql.prepare("SELECT snapshot_json FROM team_publications WHERE id='collaborator-E037'").get().snapshot_json);
      assert.equal(owner.members[0].name, "Current Player");
      assert.equal(collaborator.members[0].name, "collaborator E037");
      assert.equal(f.sql.prepare("SELECT count(*) AS count FROM team_publications").get().count, 8);

      await syncDiscordAnnouncements({db: f.db, env: f.env, game, eventId: eventIds[0], origin: "https://preview.example"});
      assert.equal(deliveries.length, 1);
    } finally {
      f.sql.close();
    }
  });
}

test("three-round remembered buttons resolve the message owner and selected link", async () => {
  const f = fixture("where-winds-meet");
  try {
    const eventIds = ["E037", "E038", "E039"];
    await rememberDiscordAnnouncement(f.db, {game: "where-winds-meet", organizerId: "owner", eventIds, channelId: f.env.DISCORD_CHANNEL_ID, messageId: "22345678901234567"});
    const response = await discordInteractionApi(await buttonRequest(f.env, ["E039", "E037", "E038"], 2), f.env);
    const interaction = await response.json();
    assert.equal(interaction.type, 7, JSON.stringify(interaction));
    assert.equal(interaction.data.embeds[0].fields[0].value, "• owner E038");
    assert.equal(interaction.data.embeds[0].url, "https://preview.example/games/where-winds-meet/guild-war/published/E038/owner-E038");
    const buttons = interaction.data.components[0].components;
    assert.equal(buttons.length, 4);
    assert.equal(buttons[2].style, 3);
    assert.equal(buttons[2].custom_id, "pom-war|E039,E037,E038|2");
    assert.equal(buttons[3].url, "https://preview.example/games/where-winds-meet/guild-war/published/E038/owner-E038");
  } finally {
    f.sql.close();
  }
});
