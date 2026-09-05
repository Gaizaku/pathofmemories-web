-- Initial registration foundation. Apply only to a NEW test database.
PRAGMA foreign_keys = ON;
CREATE TABLE games (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE players (
  game_id TEXT NOT NULL REFERENCES games(id), id TEXT NOT NULL,
  character_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(game_id,id)
);
CREATE TABLE weapons (
  game_id TEXT NOT NULL REFERENCES games(id), id TEXT NOT NULL, name TEXT NOT NULL,
  PRIMARY KEY(game_id,id)
);
CREATE TABLE loadouts (
  game_id TEXT NOT NULL, id TEXT NOT NULL, player_id TEXT NOT NULL,
  role TEXT NOT NULL, main_weapon_id TEXT NOT NULL, sub_weapon_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(game_id,id), UNIQUE(game_id,player_id,id),
  FOREIGN KEY(game_id,player_id) REFERENCES players(game_id,id),
  FOREIGN KEY(game_id,main_weapon_id) REFERENCES weapons(game_id,id),
  FOREIGN KEY(game_id,sub_weapon_id) REFERENCES weapons(game_id,id),
  CHECK(main_weapon_id <> sub_weapon_id)
);
CREATE TABLE events (
  game_id TEXT NOT NULL REFERENCES games(id), id TEXT NOT NULL,
  starts_at TEXT NOT NULL, local_date TEXT NOT NULL, week_start TEXT NOT NULL,
  war_type TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','closed','cancelled')),
  capacity INTEGER NOT NULL CHECK(capacity > 0),
  PRIMARY KEY(game_id,id), UNIQUE(game_id,starts_at,war_type)
);
CREATE INDEX events_week ON events(game_id,week_start,status);
CREATE TABLE attendance_choices (
  game_id TEXT NOT NULL, event_id TEXT NOT NULL, player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('attending','unavailable')),
  preferred_role TEXT, note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  PRIMARY KEY(game_id,event_id,player_id),
  FOREIGN KEY(game_id,event_id) REFERENCES events(game_id,id),
  FOREIGN KEY(game_id,player_id) REFERENCES players(game_id,id)
);
CREATE TABLE attendance_loadouts (
  game_id TEXT NOT NULL, event_id TEXT NOT NULL, player_id TEXT NOT NULL, loadout_id TEXT NOT NULL,
  PRIMARY KEY(game_id,event_id,player_id,loadout_id),
  FOREIGN KEY(game_id,event_id,player_id) REFERENCES attendance_choices(game_id,event_id,player_id),
  FOREIGN KEY(game_id,player_id,loadout_id) REFERENCES loadouts(game_id,player_id,id)
);
CREATE TABLE regular_rules (
  game_id TEXT NOT NULL, player_id TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), starts_on TEXT, ends_on TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(game_id,player_id),
  FOREIGN KEY(game_id,player_id) REFERENCES players(game_id,id),
  CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE TABLE regular_slots (
  game_id TEXT NOT NULL, player_id TEXT NOT NULL, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  war_type TEXT NOT NULL,
  PRIMARY KEY(game_id,player_id,weekday,war_type),
  FOREIGN KEY(game_id,player_id) REFERENCES regular_rules(game_id,player_id)
);
CREATE TABLE weekly_absences (
  game_id TEXT NOT NULL, player_id TEXT NOT NULL, week_start TEXT NOT NULL,
  PRIMARY KEY(game_id,player_id,week_start),
  FOREIGN KEY(game_id,player_id) REFERENCES players(game_id,id)
);
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), actor_id TEXT NOT NULL,
  action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL
);
