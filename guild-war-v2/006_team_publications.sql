-- Immutable publications are separate from private editable drafts.
CREATE TABLE IF NOT EXISTS team_publications (
 id TEXT PRIMARY KEY,
 game_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 organizer_id TEXT NOT NULL REFERENCES organizers(discord_user_id),
 draft_revision INTEGER NOT NULL CHECK(draft_revision > 0),
 snapshot_json TEXT NOT NULL,
 published_at TEXT NOT NULL,
 UNIQUE(game_id,event_id,organizer_id,draft_revision),
 FOREIGN KEY(game_id,event_id) REFERENCES events(game_id,id)
);
