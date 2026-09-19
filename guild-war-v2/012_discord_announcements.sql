-- Keep one Discord message per four-round announcement group and update it in place.
CREATE TABLE IF NOT EXISTS discord_announcements (
  announcement_key TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  organizer_id TEXT NOT NULL REFERENCES organizers(discord_user_id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  event_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_status TEXT NOT NULL DEFAULT 'sent',
  change_version INTEGER NOT NULL DEFAULT 0,
  claimed_version INTEGER NOT NULL DEFAULT 0,
  synced_version INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS discord_announcements_game ON discord_announcements(game_id);
