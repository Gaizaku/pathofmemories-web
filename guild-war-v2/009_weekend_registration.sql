-- Additive migration: preserve historical events and organizer rules.
CREATE TABLE IF NOT EXISTS member_preferences (
  game_id TEXT NOT NULL, player_id TEXT NOT NULL, token_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0, regular INTEGER NOT NULL DEFAULT 0,
  slots_json TEXT NOT NULL DEFAULT '[]', loadouts_json TEXT NOT NULL DEFAULT '[]',
  preferred_role TEXT, preferred_team TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL, operation_id TEXT NOT NULL,
  PRIMARY KEY (game_id,player_id),
  FOREIGN KEY (game_id,player_id) REFERENCES players(game_id,id)
);
