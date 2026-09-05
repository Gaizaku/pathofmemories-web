/** Explicit round choice > weekly absence > regular default. Never writes registrations. */
export function resolveAttendance({ event, player, choice, weekAbsent = false, regular }) {
  if (!player.active || event.status === 'cancelled') return { status: 'unavailable', source: 'system' };
  if (choice) {
    if (!['attending', 'unavailable'].includes(choice.status)) throw new Error('Invalid attendance choice');
    return { status: choice.status === 'attending' ? 'confirmed' : 'unavailable', source: 'round' };
  }
  if (weekAbsent) return { status: 'unavailable', source: 'week' };
  const matches = regular?.enabled
    && (!regular.startsOn || event.localDate >= regular.startsOn)
    && (!regular.endsOn || event.localDate <= regular.endsOn)
    && regular.weekdays.includes(event.weekday)
    && regular.warTypes.includes(event.warType);
  return matches ? { status: 'expected', source: 'regular' } : { status: 'unregistered', source: 'none' };
}
