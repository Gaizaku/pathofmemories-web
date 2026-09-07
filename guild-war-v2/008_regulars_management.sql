-- Regular attendee controls for the Guild War Manager.
ALTER TABLE regular_rules ADD COLUMN default_role TEXT;
ALTER TABLE regular_rules ADD COLUMN default_loadout_id TEXT;
ALTER TABLE regular_rules ADD COLUMN preferred_team TEXT;
ALTER TABLE regular_rules ADD COLUMN paused_until TEXT;
ALTER TABLE weekly_absences ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE weekly_absences ADD COLUMN updated_at TEXT;
ALTER TABLE weekly_absences ADD COLUMN updated_by TEXT;
CREATE INDEX IF NOT EXISTS regular_slots_lookup ON regular_slots(game_id, weekday, war_type);
CREATE INDEX IF NOT EXISTS weekly_absences_lookup ON weekly_absences(game_id, week_start, player_id);
