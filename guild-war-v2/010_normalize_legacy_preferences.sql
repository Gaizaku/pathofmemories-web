-- One-time production cleanup for values written by the legacy Guild War app.
-- The new application represents "ANY" as no explicit preference.
UPDATE member_preferences
SET preferred_role = ''
WHERE game_id = 'where-winds-meet' AND preferred_role = 'ANY';

UPDATE member_preferences
SET preferred_team = ''
WHERE game_id = 'where-winds-meet' AND preferred_team = 'ANY';

UPDATE attendance_choices
SET preferred_role = NULL
WHERE game_id = 'where-winds-meet' AND preferred_role = 'ANY';
