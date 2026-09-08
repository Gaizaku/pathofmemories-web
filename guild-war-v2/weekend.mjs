export const GAME = 'where-winds-meet';
export const ROUNDS = [
  {number:1, time:'19:30', end:'', type:'League'},
  {number:2, time:'20:00', end:'20:15', type:'Rank'},
  {number:3, time:'20:30', end:'20:45', type:'Rank'},
  {number:4, time:'21:00', end:'21:15', type:'Rank'},
];
export function weekOf(now = new Date()) {
  const local = new Date(now.getTime()+7*3600000);
  local.setUTCDate(local.getUTCDate()-((local.getUTCDay()+6)%7));
  return local.toISOString().slice(0,10);
}
export function weekendDates(week) {
  return [5,6].map(offset => {const d=new Date(week+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);});
}
export function slotOf(event) {
  const local = new Date(new Date(event.starts_at).getTime()+7*3600000);
  const day = local.getUTCDay();
  const round=ROUNDS.find(r=>r.time===local.toISOString().slice(11,16));
  return [0,6].includes(day)&&round ? day+':'+round.number : null;
}
export async function rows(db,sql,...args) {
  const result=await db.prepare(sql).bind(...args).all();
  if(result.success===false)throw new Error('query_failed');
  return result.results;
}
// Reuse existing IDs so saved teams and registrations keep their references.
// Only this week's future rounds are normalized; historical rows remain untouched.
export async function ensureWeekend(db,now=new Date()) {
  const week=weekOf(now),result=[];
  const existing=await rows(db,'SELECT * FROM events WHERE game_id=? AND week_start=? ORDER BY starts_at,id',GAME,week);
  const writes=[];
  for(const date of weekendDates(week)) {
    const daily=existing.filter(e=>e.local_date===date);
    const league=daily.filter(e=>e.war_type==='League');
    const rank=daily.filter(e=>['Matching','Rank'].includes(e.war_type));
    for(const round of ROUNDS) {
      const old=round.number===1?league[0]:rank[round.number-2];
      const starts=date+'T'+round.time+':00+07:00';
      const event={...(old||{}),id:old?.id||'wwm-'+date+'-'+round.number,game_id:GAME,starts_at:starts,local_date:date,week_start:week,war_type:round.type,status:old?.status||'open',capacity:old?.capacity||30};
      if(new Date(starts)>now && (!old || old.starts_at!==starts || old.war_type!==round.type)) {
        writes.push(db.prepare('INSERT INTO events (game_id,id,starts_at,local_date,week_start,war_type,status,capacity) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(game_id,id) DO UPDATE SET starts_at=excluded.starts_at,war_type=excluded.war_type').bind(GAME,event.id,starts,date,week,round.type,event.status,event.capacity));
      } else if(new Date(starts)<=now) {if(old)Object.assign(event,old);else continue;}
      result.push({...event,slot:slotOf(event),round_number:round.number,ends_at:round.end});
    }
  }
  if(writes.length)await db.batch(writes);
  return {weekStart:week,events:result};
}
export const validSlots = value => Array.isArray(value)&&value.length<=8&&new Set(value).size===value.length&&value.every(s=>/^(0|6):[1-4]$/.test(s));
