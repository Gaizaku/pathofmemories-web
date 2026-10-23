-- Keep event identities and history intact when organizers pause a recurring slot.
CREATE TABLE IF NOT EXISTS war_schedule_pauses (
  game_id TEXT NOT NULL REFERENCES games(id),
  id TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  slots_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  disabled_at TEXT,
  disabled_by TEXT,
  PRIMARY KEY (game_id, id),
  CHECK (starts_on <= ends_on)
);

CREATE INDEX IF NOT EXISTS war_schedule_pauses_dates
  ON war_schedule_pauses (game_id, starts_on, ends_on)
  WHERE disabled_at IS NULL;

-- A stable ID and soft cancellation prevent a redeploy from reinstating this pause.
INSERT OR IGNORE INTO war_schedule_pauses
  (game_id,id,starts_on,ends_on,slots_json,note,created_at,created_by)
SELECT 'where-winds-meet','league-break-2026-10-24','2026-10-24','2026-11-08',
  '["6:1","0:1"]','พักรอบ League 19:30 ชั่วคราว 3 สัปดาห์',
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),'system'
WHERE EXISTS (SELECT 1 FROM games WHERE id='where-winds-meet');
