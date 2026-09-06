export function rowsToObjects(rows) {
  const [header = [], ...data] = rows;
  return data
    .filter((row) => row.some((value) => value !== "" && value != null))
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

function issue(entity, id, reason) {
  return { entity, id, reason };
}

export function inspectImportSnapshot(source) {
  const players = rowsToObjects(source.players);
  const weapons = rowsToObjects(source.weapons);
  const loadouts = rowsToObjects(source.loadouts);
  const events = rowsToObjects(source.events);
  const registrations = rowsToObjects(source.registrations);
  const registrationRoles = rowsToObjects(source.registrationRoles);

  const playerIds = new Set(players.map((row) => row.player_id));
  const weaponIds = new Set(weapons.map((row) => row.weapon_id));
  const loadoutById = new Map(loadouts.map((row) => [row.loadout_id, row]));
  const eventIds = new Set(events.map((row) => row.event_id));
  const registrationById = new Map(registrations.map((row) => [row.registration_id, row]));
  const issues = [];

  for (const row of loadouts) {
    if (!playerIds.has(row.player_id)) issues.push(issue("loadout", row.loadout_id, "missing_player"));
    if (!weaponIds.has(row.main_weapon_id)) issues.push(issue("loadout", row.loadout_id, "missing_main_weapon"));
    if (!weaponIds.has(row.sub_weapon_id)) issues.push(issue("loadout", row.loadout_id, "missing_sub_weapon"));
    if (row.main_weapon_id && row.main_weapon_id === row.sub_weapon_id) issues.push(issue("loadout", row.loadout_id, "same_weapon_twice"));
  }

  for (const row of registrations) {
    if (!eventIds.has(row.event_id)) issues.push(issue("registration", row.registration_id, "missing_event"));
    if (!playerIds.has(row.player_id)) issues.push(issue("registration", row.registration_id, "missing_player"));
  }

  for (const row of registrationRoles) {
    const registration = registrationById.get(row.registration_id);
    const loadout = loadoutById.get(row.loadout_id);
    if (!registration) issues.push(issue("registration_role", row.registration_id, "missing_registration"));
    if (!loadout) issues.push(issue("registration_role", row.registration_id, "missing_loadout"));
    if (registration && loadout && registration.player_id !== loadout.player_id) {
      issues.push(issue("registration_role", row.registration_id, "loadout_owned_by_different_player"));
    }
  }

  return {
    counts: {
      players: players.length,
      weapons: weapons.length,
      loadouts: loadouts.length,
      events: events.length,
      registrations: registrations.length,
      registrationRoles: registrationRoles.length,
    },
    issues,
  };
}
