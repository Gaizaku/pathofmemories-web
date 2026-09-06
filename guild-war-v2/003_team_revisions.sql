-- Published team plans are immutable snapshots. Draft work remains outside this table.
CREATE TABLE team_revisions (
  game_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('published', 'superseded')),
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL,
  discord_message_id TEXT,
  PRIMARY KEY(game_id, event_id, revision),
  FOREIGN KEY(game_id, event_id) REFERENCES events(game_id, id)
);

CREATE TABLE team_assignments (
  game_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  squad TEXT NOT NULL,
  role TEXT,
  position TEXT,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(game_id, event_id, revision, player_id),
  FOREIGN KEY(game_id, event_id, revision)
    REFERENCES team_revisions(game_id, event_id, revision),
  FOREIGN KEY(game_id, player_id) REFERENCES players(game_id, id)
);

CREATE INDEX team_assignments_event ON team_assignments(game_id, event_id, revision, squad);
