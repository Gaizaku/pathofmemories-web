-- Guest claim tokens are stored only as SHA-256 hashes.
CREATE TABLE registration_claims (
  game_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  PRIMARY KEY(game_id, event_id, player_id),
  FOREIGN KEY(game_id, event_id, player_id)
    REFERENCES attendance_choices(game_id, event_id, player_id)
);
