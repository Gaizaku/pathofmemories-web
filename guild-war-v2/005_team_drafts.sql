-- Private organizer drafts are separate from published team revisions.
CREATE TABLE IF NOT EXISTS team_drafts (
 game_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 organizer_id TEXT NOT NULL REFERENCES organizers(discord_user_id),
 revision INTEGER NOT NULL CHECK(revision > 0),
 board_json TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(game_id,event_id,organizer_id),
 FOREIGN KEY(game_id,event_id) REFERENCES events(game_id,id)
);
