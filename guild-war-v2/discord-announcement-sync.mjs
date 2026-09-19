import {attachPublicationUrls, buildAnnouncementPayload, loadPublishedRounds} from "./discord-announcement.mjs";
import {readApi} from "./read-api.mjs";

const discordIdPattern = /^\d{15,25}$/;

export function announcementGroupKey(game, eventIds) {
  return String(game) + ":" + [...eventIds].sort().join(",");
}

export function discordAnnouncementEditRequest({channelId, messageId, token, payload}) {
  return {
    url: "https://discord.com/api/v10/channels/" + channelId + "/messages/" + messageId,
    options: {
      method: "PATCH",
      headers: {"Authorization": "Bot " + token, "Content-Type": "application/json"},
      body: JSON.stringify(payload),
    },
  };
}

function parseEventIds(row) {
  try {
    const eventIds = JSON.parse(row.event_ids_json);
    return Array.isArray(eventIds) && eventIds.length === 4 ? eventIds : [];
  } catch {
    return [];
  }
}

async function markAnnouncementChange(db, game, eventId) {
  const result = await db.prepare("SELECT announcement_key,event_ids_json FROM discord_announcements WHERE game_id=?").bind(game).all();
  const statements = (result.results || []).filter(row => parseEventIds(row).includes(eventId)).map(row =>
    db.prepare("UPDATE discord_announcements SET change_version=change_version+1,updated_at=? WHERE announcement_key=?")
      .bind(new Date().toISOString(), row.announcement_key)
  );
  if (statements.length) await db.batch(statements);
}

function schedule(promise, executionContext) {
  if (executionContext?.waitUntil) executionContext.waitUntil(promise);
  else void promise;
}

export function scheduleDiscordAnnouncementSync({db, env, game, eventId, organizerId, origin, executionContext}) {
  const promise = (async () => {
    await markAnnouncementChange(db, game, eventId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await syncDiscordAnnouncements({db, env, game, eventId, organizerId, origin});
  })().catch(() => undefined);
  schedule(promise, executionContext);
}

async function loadCurrentSnapshot({db, env, game, eventId, organizerId, origin}) {
  const draft = await db.prepare("SELECT revision,board_json FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=?").bind(game, eventId, organizerId).first();
  if (!draft) return null;
  const rosterResponse = await readApi(new Request(origin + "/api/v2/games/" + game + "/war/events/" + eventId + "/registrations"), env);
  if (!rosterResponse.ok) return null;
  const source = await rosterResponse.json();
  if (source.event?.status === "cancelled") return null;
  const {publicationSnapshot} = await import("./team-publication-api.mjs");
  try {
    return {organizerId, revision: draft.revision, snapshot: publicationSnapshot(JSON.parse(draft.board_json), source)};
  } catch {
    return null;
  }
}

async function updatePublicationSnapshot(db, game, eventId, current) {
  if (!current) return false;
  const row = await db.prepare("SELECT id,organizer_id,draft_revision,snapshot_json FROM team_publications WHERE game_id=? AND event_id=? ORDER BY published_at DESC LIMIT 1").bind(game, eventId).first();
  const nextSnapshot = JSON.stringify(current.snapshot);
  if (!row || (row.organizer_id === current.organizerId && Number(row.draft_revision) >= Number(current.revision) && row.snapshot_json === nextSnapshot)) return false;
  await db.prepare("UPDATE team_publications SET organizer_id=?,draft_revision=?,snapshot_json=? WHERE id=?")
    .bind(current.organizerId, current.revision, nextSnapshot, row.id).run();
  return true;
}

async function editAnnouncement(env, announcement, rounds) {
  if (!env.DISCORD_BOT_TOKEN || !discordIdPattern.test(announcement.channel_id) || !discordIdPattern.test(announcement.message_id)) return "unconfigured";
  const payload = buildAnnouncementPayload(attachPublicationUrls(rounds, env.PUBLIC_ORIGIN || "https://pathofmemories.com"), 0);
  const request = discordAnnouncementEditRequest({channelId: announcement.channel_id, messageId: announcement.message_id, token: env.DISCORD_BOT_TOKEN, payload});
  try {
    const response = await fetch(request.url, request.options);
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function syncAnnouncement({db, env, game, announcement, eventId, organizerId, origin}) {
  const claim = await db.prepare("UPDATE discord_announcements SET claimed_version=change_version WHERE announcement_key=? AND claimed_version<change_version").bind(announcement.announcement_key).run();
  if (claim.meta?.changes !== 1) return;
  const current = await loadCurrentSnapshot({db, env, game, eventId, organizerId: organizerId || announcement.organizer_id, origin});
  if (current) await updatePublicationSnapshot(db, game, eventId, current);
  const loaded = await loadPublishedRounds(db, game, parseEventIds(announcement));
  if (loaded.missing.length) return;
  const result = await editAnnouncement(env, announcement, loaded.rounds);
  await db.prepare("UPDATE discord_announcements SET synced_version=claimed_version,last_sync_status=?,updated_at=? WHERE announcement_key=?")
    .bind(result, new Date().toISOString(), announcement.announcement_key).run();
}

export async function syncDiscordAnnouncements({db, env, game, eventId, organizerId, origin}) {
  const result = await db.prepare("SELECT * FROM discord_announcements WHERE game_id=?").bind(game).all();
  for (const announcement of result.results || []) {
    if (parseEventIds(announcement).includes(eventId)) {
      await syncAnnouncement({db, env, game, announcement, eventId, organizerId, origin});
    }
  }
}

export async function rememberDiscordAnnouncement(db, {game, organizerId, eventIds, channelId, messageId}) {
  const sortedEventIds = [...eventIds].sort();
  const key = announcementGroupKey(game, sortedEventIds);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO discord_announcements
    (announcement_key,game_id,organizer_id,channel_id,message_id,event_ids_json,created_at,updated_at,last_sync_status,change_version,claimed_version,synced_version)
    VALUES (?,?,?,?,?,?,?,?,'sent',0,0,0)
    ON CONFLICT(announcement_key) DO UPDATE SET organizer_id=excluded.organizer_id,channel_id=excluded.channel_id,message_id=excluded.message_id,event_ids_json=excluded.event_ids_json,updated_at=excluded.updated_at,last_sync_status='sent',change_version=0,claimed_version=0,synced_version=0`)
    .bind(key, game, organizerId, channelId, messageId, JSON.stringify(sortedEventIds), now, now).run();
  return key;
}
