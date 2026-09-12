import { inspectImportSnapshot, rowsToObjects } from "./import-preview.mjs";

const GAME_ID = "where-winds-meet";
const ROLES = new Set(["Tank", "Heal", "DPS"]);
const TEAMS = new Set(["", "ATTACK_1", "ATTACK_2", "ATTACK_3", "DEFENSE_1", "DEFENSE_2", "FOREST", "STANDBY"]);

// The legacy app used ANY as a display value. The new database represents it
// with an empty preference, so imports cannot create a value the registration
// API will reject later.
function preferredRole(value) {
  return ROLES.has(value) ? value : "";
}

function preferredTeam(value) {
  return TEAMS.has(value) ? value : "";
}

function asFlag(value) {
  return value === true || value === 1 || value === "TRUE" || value === "true" ? 1 : 0;
}

function dateTime(date, time) {
  return `${date}T${time}:00+07:00`;
}

export function bangkokWeekStart(date) {
  const localNoon = new Date(`${date}T12:00:00+07:00`);
  const daysSinceMonday = (localNoon.getUTCDay() + 6) % 7;
  localNoon.setUTCDate(localNoon.getUTCDate() - daysSinceMonday);
  return localNoon.toISOString().slice(0, 10);
}

export function buildImportPlan(source) {
  const report = inspectImportSnapshot(source);
  const blockedLoadouts = new Set(report.issues.filter((item) => item.entity === "loadout").map((item) => item.id));
  const blockedRegistrations = new Set(report.issues.filter((item) => item.entity === "registration").map((item) => item.id));
  const blockedRoles = new Set(report.issues.filter((item) => item.entity === "registration_role").map((item) => item.id));
  const registrations = rowsToObjects(source.registrations);
  const registrationRoles = rowsToObjects(source.registrationRoles);

  const statements = [{
    sql: "INSERT INTO games (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
    params: [GAME_ID, "Where Winds Meet"],
  }];

  for (const row of rowsToObjects(source.players)) {
    statements.push({
      sql: "INSERT INTO players (game_id, id, character_name, nickname, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(game_id, id) DO UPDATE SET character_name = excluded.character_name, nickname = excluded.nickname, active = excluded.active",
      params: [GAME_ID, row.player_id, row.character_name, row.nickname || "", asFlag(row.active)],
    });
  }

  for (const row of rowsToObjects(source.weapons)) {
    statements.push({
      sql: "INSERT INTO weapons (game_id, id, name) VALUES (?, ?, ?) ON CONFLICT(game_id, id) DO UPDATE SET name = excluded.name",
      params: [GAME_ID, row.weapon_id, row.weapon_name],
    });
  }

  for (const row of rowsToObjects(source.loadouts)) {
    if (blockedLoadouts.has(row.loadout_id)) continue;
    statements.push({
      sql: "INSERT INTO loadouts (game_id, id, player_id, role, main_weapon_id, sub_weapon_id, active) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(game_id, id) DO UPDATE SET player_id = excluded.player_id, role = excluded.role, main_weapon_id = excluded.main_weapon_id, sub_weapon_id = excluded.sub_weapon_id, active = excluded.active",
      params: [GAME_ID, row.loadout_id, row.player_id, row.role, row.main_weapon_id, row.sub_weapon_id, asFlag(row.active)],
    });
  }

  // Carry the legacy registration preferences into the new member profile so
  // organizers can still see each player's preferred team and chosen builds.
  const profileByPlayer = new Map();
  for (const registration of registrations) {
    if (!profileByPlayer.has(registration.player_id)) {
      profileByPlayer.set(registration.player_id, {role: preferredRole(registration.preferred_role), team: preferredTeam(registration.preferred_squad), submittedAt: registration.submitted_at || "", loadouts: new Set()});
    }
    const profile = profileByPlayer.get(registration.player_id);
    if ((registration.submitted_at || "") >= profile.submittedAt) {
      profile.role = preferredRole(registration.preferred_role);
      profile.team = preferredTeam(registration.preferred_squad);
      profile.submittedAt = registration.submitted_at || "";
    }
    for (const selected of registrationRoles.filter((item) => item.registration_id === registration.registration_id)) {
      if (!blockedRoles.has(selected.registration_id) && !blockedLoadouts.has(selected.loadout_id)) profile.loadouts.add(selected.loadout_id);
    }
  }
  for (const [playerId, profile] of profileByPlayer) {
    statements.push({
      sql: "INSERT INTO member_preferences (game_id, player_id, token_hash, revision, regular, slots_json, loadouts_json, preferred_role, preferred_team, updated_at, operation_id) VALUES (?, ?, ?, 0, 0, '[]', ?, ?, ?, ?, 'legacy-import') ON CONFLICT(game_id, player_id) DO UPDATE SET loadouts_json = excluded.loadouts_json, preferred_role = excluded.preferred_role, preferred_team = excluded.preferred_team, updated_at = excluded.updated_at",
      params: [GAME_ID, playerId, "legacy-import", JSON.stringify([...profile.loadouts]), profile.role, profile.team, profile.submittedAt || "1970-01-01T00:00:00Z"],
    });
  }

  for (const row of rowsToObjects(source.events)) {
    if (!row.event_id || !row.date || !row.time) continue;
    statements.push({
      sql: "INSERT INTO events (game_id, id, starts_at, local_date, week_start, war_type, status, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(game_id, id) DO UPDATE SET starts_at = excluded.starts_at, local_date = excluded.local_date, week_start = excluded.week_start, war_type = excluded.war_type, status = excluded.status, capacity = excluded.capacity",
      params: [GAME_ID, row.event_id, dateTime(row.date, row.time), row.date, bangkokWeekStart(row.date), row.war_type, row.registration_status === "OPEN" ? "open" : "closed", Number(row.max_players)],
    });
  }

  for (const row of registrations) {
    if (blockedRegistrations.has(row.registration_id)) continue;
    statements.push({
      sql: "INSERT INTO attendance_choices (game_id, event_id, player_id, status, preferred_role, note, updated_at, updated_by) VALUES (?, ?, ?, 'attending', ?, ?, ?, ?) ON CONFLICT(game_id, event_id, player_id) DO UPDATE SET preferred_role = excluded.preferred_role, note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      params: [GAME_ID, row.event_id, row.player_id, preferredRole(row.preferred_role) || null, row.note || "", row.submitted_at || "1970-01-01T00:00:00Z", "legacy-import"],
    });
  }

  for (const row of registrationRoles) {
    if (blockedRoles.has(row.registration_id)) continue;
    const registration = registrations.find((item) => item.registration_id === row.registration_id);
    if (!registration || blockedRegistrations.has(registration.registration_id) || blockedLoadouts.has(row.loadout_id)) continue;
    statements.push({
      sql: "INSERT OR IGNORE INTO attendance_loadouts (game_id, event_id, player_id, loadout_id) VALUES (?, ?, ?, ?)",
      params: [GAME_ID, registration.event_id, registration.player_id, row.loadout_id],
    });
  }

  return { report, statements };
}
