import {activeOrganizer} from './organizer-auth.mjs';
import {GAME,ROUNDS,ensureWeekend,validSlots} from './weekend.mjs';
import {loadSchedulePauses} from './war-schedule.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const validDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;

export async function warScheduleApi(request,env,now=new Date()) {
  const url=new URL(request.url);
  const route=/^\/api\/v2\/games\/where-winds-meet\/war\/schedule(?:\/([A-Za-z0-9-]{1,64}))?$/.exec(url.pathname);
  if(!route)return null;
  const id=route[1];
  if(url.search)return json({error:'unsupported_query'},400);
  if(id?request.method!=='DELETE':!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405);
  if(request.method!=='GET' && request.headers.get('Origin')!==url.origin)return json({error:'invalid_origin'},403);
  if(!env.GUILD_WAR_DB)return json({error:'database_not_configured'},503);
  try {
    const organizer=await activeOrganizer(env,request);
    if(!organizer)return json({error:'organizer_required'},401);
    const db=env.GUILD_WAR_DB;
    if(request.method==='GET') {
      const schedule=await ensureWeekend(db,now);
      return json({today:new Date(now.getTime()+7*3600000).toISOString().slice(0,10),...schedule,
        slots:[6,0].flatMap(weekday=>ROUNDS.map(round=>({slot:weekday+':'+round.number,weekday,roundNumber:round.number,time:round.time,warType:round.type}))),
        pauses:await loadSchedulePauses(db,GAME)});
    }
    const timestamp=now.toISOString(),operation=crypto.randomUUID();
    if(request.method==='DELETE') {
      // The adjacent audit statement records only a successful cancellation in this batch.
      const result=await db.batch([
        db.prepare('UPDATE war_schedule_pauses SET disabled_at=?,disabled_by=? WHERE game_id=? AND id=? AND disabled_at IS NULL').bind(timestamp,organizer.id,GAME,id),
        db.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(operation,GAME,organizer.id,'war_schedule_restored',id,timestamp)
      ]);
      return result[0].meta.changes===1?json({id}):json({error:'pause_not_found'},404);
    }
    const raw=await request.text();
    if(raw.length>3000)return json({error:'too_large'},413);
    let data;try{data=JSON.parse(raw);}catch{return json({error:'invalid_request'},400);}
    if(!data || !validDate(data.startsOn) || !validDate(data.endsOn) || data.startsOn>data.endsOn ||
      !validSlots(data.slots) || !data.slots.length || typeof(data.note??'')!=='string' || (data.note??'').length>240)
      return json({error:'invalid_request'},400);
    await db.batch([
      db.prepare('INSERT INTO war_schedule_pauses (game_id,id,starts_on,ends_on,slots_json,note,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)').bind(GAME,operation,data.startsOn,data.endsOn,JSON.stringify(data.slots),data.note?.trim()||'',timestamp,organizer.id),
      db.prepare('INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),GAME,organizer.id,'war_schedule_paused',operation,timestamp)
    ]);
    return json({id:operation},201);
  }catch{return json({error:'schedule_unavailable'},503);}
}
