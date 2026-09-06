-- Discord access is required only for Organizer actions.
CREATE TABLE organizers (
  discord_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  return_path TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE organizer_sessions (
  session_hash TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL REFERENCES organizers(discord_user_id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX organizer_sessions_expiry ON organizer_sessions(expires_at);
