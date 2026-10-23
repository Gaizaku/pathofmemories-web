export async function loadSchedulePauses(db,game,from='0000-01-01',through='9999-12-31') {
  const result=await db.prepare('SELECT id,starts_on,ends_on,slots_json,note,created_at FROM war_schedule_pauses WHERE game_id=? AND disabled_at IS NULL AND ends_on>=? AND starts_on<=? ORDER BY starts_on,created_at,id').bind(game,from,through).all();
  if(result.success===false)throw new Error('query_failed');
  return result.results.map(row=>({id:row.id,startsOn:row.starts_on,endsOn:row.ends_on,slots:JSON.parse(row.slots_json),note:row.note,createdAt:row.created_at}));
}

export function isSlotPaused(pauses,date,slot) {
  return pauses.some(pause=>pause.startsOn<=date && date<=pause.endsOn && pause.slots.includes(slot));
}
