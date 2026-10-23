import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GAME,ensureWeekend} from './weekend.mjs';
import {memberRegistration} from './member-registration.mjs';
import {readApi} from './read-api.mjs';
import {teamDraftApi} from './team-draft-api.mjs';

const clock=new Date('2026-10-23T10:00:00Z');
const origin='https://example.com';
const base=origin+'/api/v2/games/'+GAME;
const migration=readFileSync(new URL('./013_war_schedule.sql',import.meta.url),'utf8');

function fixture() {
  const sql=new DatabaseSync(':memory:');
  for(const name of ['001_registration.sql','002_registration_claims.sql','004_organizer_auth.sql','005_team_drafts.sql','009_weekend_registration.sql'])
    sql.exec(readFileSync(new URL(name,import.meta.url),'utf8'));
  sql.exec(`INSERT INTO games VALUES ('${GAME}','WWM');
    INSERT INTO players (game_id,id,character_name,nickname) VALUES ('${GAME}','p1','Hero','Golf');
    INSERT INTO weapons VALUES ('${GAME}','w1','Sword'),('${GAME}','w2','Spear');
    INSERT INTO loadouts (game_id,id,player_id,role,main_weapon_id,sub_weapon_id) VALUES ('${GAME}','l1','p1','DPS','w1','w2');
    INSERT INTO organizers VALUES ('9','Organizer',1,'2026-01-01');`);
  sql.exec(migration);
  sql.prepare('INSERT INTO organizer_sessions VALUES (?,?,?,?)').run(createHash('sha256').update('schedule-session').digest('hex'),'9','2099-01-01','2026-01-01');
  const db={prepare(query){const statement={bind(...args){return {
    all:async()=>({results:sql.prepare(query).all(...args)}),
    first:async()=>sql.prepare(query).get(...args),
    run:async()=>({meta:sql.prepare(query).run(...args)})
  }}};return statement;},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  const env={GUILD_WAR_DB:db};
  const member=async(action,body,now=clock)=>{
    if(action==='save'&&!Object.hasOwn(body,'scheduleVersion')) {
      const schedule=await (await memberRegistration(new Request(base+'/member-registration'),env,now)).json();
      body={...body,scheduleVersion:schedule.scheduleVersion};
    }
    return memberRegistration(new Request(base+'/member-registration/'+action,{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),env,now);
  };
  const schedule=async(method='GET',body,options={})=>{
    const {warScheduleApi}=await import('./war-schedule-api.mjs');
    const headers={Origin:options.origin??origin,...(options.auth===false?{}:{Cookie:'pom_organizer_session=schedule-session'})};
    return warScheduleApi(new Request(base+'/war/schedule'+(options.path||''),{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,clock);
  };
  return {sql,db,env,member,schedule};
}

test('hides only League on all three paused weekends and automatically restores it afterward',async()=>{
  const f=fixture();try {
    for(const date of ['2026-10-23','2026-10-30','2026-11-06']) {
      const result=await ensureWeekend(f.db,new Date(date+'T10:00:00Z'));
      assert.equal(result.events.length,6,date);
      assert.deepEqual(result.events.map(event=>event.war_type),['Rank','Rank','Rank','Rank','Rank','Rank']);
      assert.deepEqual(result.events.map(event=>event.round_number),[2,3,4,2,3,4]);
    }
    const restored=await ensureWeekend(f.db,new Date('2026-11-13T10:00:00Z'));
    assert.equal(restored.events.length,8);
    assert.equal(restored.events[0].starts_at,'2026-11-14T19:30:00+07:00');
    assert.equal(restored.events[4].starts_at,'2026-11-15T19:30:00+07:00');
  }finally{f.sql.close();}
});

test('public registration and Team Builder lists agree about paused slots',async()=>{
  const f=fixture();try {
    const member=await memberRegistration(new Request(base+'/member-registration'),f.env,clock);
    const builder=await readApi(new Request(base+'/war/events'),f.env,clock);
    const registration=await member.json(),teams=await builder.json();
    assert.equal(registration.events.length,6);
    assert.deepEqual(teams.events.map(x=>x.id),registration.events.map(x=>x.id));
  }finally{f.sql.close();}
});

test('pausing a slot preserves event IDs, registration notes and saved teams',async()=>{
  const f=fixture();try {
    await ensureWeekend(f.db,clock);
    const eventId='wwm-2026-10-24-1';
    f.sql.prepare('INSERT INTO attendance_choices (game_id,event_id,player_id,status,note,updated_at,updated_by) VALUES (?,?,?,?,?,?,?)').run(GAME,eventId,'p1','attending','Keep this note','2026-10-23','member');
    f.sql.prepare('INSERT INTO team_drafts (game_id,event_id,organizer_id,revision,board_json,updated_at) VALUES (?,?,?,?,?,?)').run(GAME,eventId,'9',3,'{"p1":{"team":"ATTACK_1","loadout":"l1"}}','2026-10-23');
    await ensureWeekend(f.db,clock);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM events').get().n,8);
    assert.equal(f.sql.prepare('SELECT note FROM attendance_choices WHERE event_id=?').get(eventId).note,'Keep this note');
    assert.equal(f.sql.prepare('SELECT revision FROM team_drafts WHERE event_id=?').get(eventId).revision,3);
    const response=await f.schedule('DELETE',undefined,{path:'/league-break-2026-10-24'});
    assert.equal(response.status,200);
    const restored=await ensureWeekend(f.db,clock);
    assert.equal(restored.events[0].id,eventId);
    assert.equal(restored.events.length,8);
  }finally{f.sql.close();}
});

test('saving visible rounds preserves hidden member recurring slots until the pause expires',async()=>{
  const f=fixture();try {
    f.sql.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,regular,slots_json,loadouts_json,updated_at,operation_id) VALUES (?,?,?,?,?,?,?,?)')
      .run(GAME,'p1','unused',1,'["6:1","6:2","0:1"]','["l1"]','2026-10-23','old-operation');
    const profile=await (await f.member('lookup',{playerId:'p1'})).json();
    assert.equal(profile.regular,true);
    assert.deepEqual(profile.regularSlots,['wwm-2026-10-24-2']);
    const saved=await f.member('save',{playerId:'p1',weekStart:'2026-10-19',selected:profile.selected,regularSlots:profile.regularSlots,loadoutIds:['l1'],regular:true,revision:0});
    assert.equal(saved.status,200);
    assert.deepEqual(JSON.parse(f.sql.prepare('SELECT slots_json FROM member_preferences').get().slots_json).sort(),['0:1','6:1','6:2']);
    const restored=await (await f.member('lookup',{playerId:'p1'},new Date('2026-11-13T10:00:00Z'))).json();
    assert.deepEqual(restored.regularSlots,['wwm-2026-11-14-1','wwm-2026-11-14-2','wwm-2026-11-15-1']);
  }finally{f.sql.close();}
});

test('saving visible rounds preserves hidden organizer regular rules',async()=>{
  const f=fixture();try {
    f.sql.exec(`INSERT INTO regular_rules (game_id,player_id,enabled) VALUES ('${GAME}','p1',1);
      INSERT INTO regular_slots VALUES ('${GAME}','p1',6,'League'),('${GAME}','p1',6,'Matching'),('${GAME}','p1',0,'League');`);
    const profile=await (await f.member('lookup',{playerId:'p1'})).json();
    assert.equal(profile.regular,true);
    assert.equal(profile.regularSlots.length,3);
    assert.equal((await f.member('save',{playerId:'p1',weekStart:'2026-10-19',selected:profile.selected,regularSlots:profile.regularSlots,loadoutIds:['l1'],regular:true,revision:0})).status,200);
    const rows=f.sql.prepare('SELECT weekday,war_type FROM regular_slots ORDER BY weekday,war_type').all();
    assert.deepEqual(rows.map(row=>[row.weekday,row.war_type]),[[0,'League'],[6,'League'],[6,'Matching']]);
  }finally{f.sql.close();}
});

for(const source of ['member','organizer'])test('rejects a stale '+source+' registration after League is restored without deleting regular slots',async()=>{
  const f=fixture();try {
    if(source==='member')f.sql.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,regular,slots_json,loadouts_json,updated_at,operation_id) VALUES (?,?,?,?,?,?,?,?)')
      .run(GAME,'p1','unused',1,'["6:1","6:2","0:1"]','["l1"]','2026-10-23','old-operation');
    else f.sql.exec(`INSERT INTO regular_rules (game_id,player_id,enabled) VALUES ('${GAME}','p1',1);
      INSERT INTO regular_slots VALUES ('${GAME}','p1',6,'League'),('${GAME}','p1',6,'Matching'),('${GAME}','p1',0,'League');`);
    const profile=await (await f.member('lookup',{playerId:'p1'})).json();
    const body={playerId:'p1',weekStart:'2026-10-19',scheduleVersion:profile.scheduleVersion,selected:profile.selected,regularSlots:profile.regularSlots,loadoutIds:['l1'],regular:true,revision:0};
    assert.equal((await f.schedule('DELETE',undefined,{path:'/league-break-2026-10-24'})).status,200);
    const response=await f.member('save',body);
    assert.equal(response.status,409);
    assert.equal((await response.json()).error,'schedule_changed');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM attendance_choices').get().n,0);
    if(source==='member') {
      const saved=f.sql.prepare('SELECT revision,slots_json FROM member_preferences').get();
      assert.equal(saved.revision,0);
      assert.deepEqual(JSON.parse(saved.slots_json),['6:1','6:2','0:1']);
    } else {
      assert.equal(f.sql.prepare('SELECT count(*) AS n FROM member_preferences').get().n,0);
      assert.deepEqual(f.sql.prepare('SELECT weekday,war_type FROM regular_slots ORDER BY weekday,war_type').all().map(row=>[row.weekday,row.war_type]),[[0,'League'],[6,'League'],[6,'Matching']]);
    }
    const latest=await (await f.member('lookup',{playerId:'p1'})).json();
    assert.notEqual(latest.scheduleVersion,profile.scheduleVersion);
    assert.equal(latest.events.length,8);
    assert.ok(latest.selected.includes('wwm-2026-10-24-1'));
  }finally{f.sql.close();}
});

test('requires a registration schedule version rather than accepting an unknown old tab',async()=>{
  const f=fixture();try {
    const response=await memberRegistration(new Request(base+'/member-registration/save',{method:'POST',headers:{Origin:origin},body:JSON.stringify({playerId:'p1',weekStart:'2026-10-19',selected:[],regularSlots:[],loadoutIds:[],regular:false,revision:0})}),f.env,clock);
    assert.equal(response.status,409);
    assert.equal((await response.json()).error,'schedule_changed');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM member_preferences').get().n,0);
  }finally{f.sql.close();}
});

test('explicitly disabling all regular registration also disables hidden League preferences',async()=>{
  const f=fixture();try {
    f.sql.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,regular,slots_json,updated_at,operation_id) VALUES (?,?,?,?,?,?,?)')
      .run(GAME,'p1','unused',1,'["6:1","0:1"]','2026-10-23','old-operation');
    assert.equal((await f.member('save',{playerId:'p1',weekStart:'2026-10-19',selected:[],regularSlots:[],loadoutIds:[],regular:false,revision:0})).status,200);
    const restored=await (await f.member('lookup',{playerId:'p1'},new Date('2026-11-13T10:00:00Z'))).json();
    assert.equal(restored.regular,false);
    assert.deepEqual(restored.selected,[]);
  }finally{f.sql.close();}
});

test('rejects a stale registration for a newly paused slot without writing preferences',async()=>{
  const f=fixture();try {
    const response=await f.member('save',{playerId:'p1',weekStart:'2026-10-19',selected:['wwm-2026-10-24-1'],regularSlots:[],loadoutIds:['l1'],regular:false,revision:0});
    assert.equal(response.status,409);
    assert.equal((await response.json()).error,'schedule_changed');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM member_preferences').get().n,0);
  }finally{f.sql.close();}
});

test('quick add cannot register a player into a paused round from a stale Team Builder',async()=>{
  const f=fixture();try {
    await ensureWeekend(f.db,clock);
    const response=await teamDraftApi(new Request(base+'/war/events/wwm-2026-10-24-1/quick-player',{
      method:'POST',headers:{Origin:origin,Cookie:'pom_organizer_session=schedule-session'},body:JSON.stringify({playerId:'p1'})
    }),f.env);
    assert.equal(response.status,409);
    assert.equal((await response.json()).error,'event_paused');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM attendance_choices').get().n,0);
  }finally{f.sql.close();}
});

test('organizer controls validate real dates, slots and same-origin authenticated writes',async()=>{
  const f=fixture();try {
    assert.equal((await f.schedule('GET',undefined,{auth:false})).status,401);
    const body={startsOn:'2026-10-24',endsOn:'2026-10-25',slots:['6:2'],note:'Saturday only'};
    assert.equal((await f.schedule('POST',body,{auth:false})).status,401);
    assert.equal((await f.schedule('POST',body,{origin:'https://evil.example'})).status,403);
    for(const change of [{startsOn:'2026-02-30'},{startsOn:'2026-10-26'},{slots:[]},{slots:['6:2','6:2']},{slots:['5:1']},{slots:['6:9']},{note:'x'.repeat(241)}])
      assert.equal((await f.schedule('POST',{...body,...change})).status,400,JSON.stringify(change));
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM war_schedule_pauses').get().n,1);
    assert.equal((await f.schedule('DELETE',undefined,{path:'/league-break-2026-10-24',origin:'https://evil.example'})).status,403);
    assert.equal((await f.schedule('DELETE',undefined,{path:'/league-break-2026-10-24',auth:false})).status,401);
  }finally{f.sql.close();}
});

test('organizers can overlap pauses, restore one without cancelling the other and audit changes',async()=>{
  const f=fixture();try {
    const response=await f.schedule('POST',{startsOn:'2026-10-24',endsOn:'2026-10-25',slots:['6:2'],note:'Saturday only'});
    assert.equal(response.status,201);
    const created=await response.json();
    const result=await ensureWeekend(f.db,clock);
    assert.deepEqual(result.events.map(x=>x.id),['wwm-2026-10-24-3','wwm-2026-10-24-4','wwm-2026-10-25-2','wwm-2026-10-25-3','wwm-2026-10-25-4']);
    assert.equal((await f.schedule('DELETE',undefined,{path:'/'+created.id})).status,200);
    assert.equal((await ensureWeekend(f.db,clock)).events.length,6);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM audit_log WHERE actor_id=?').get('9').n,2);
    const view=await (await f.schedule()).json();
    assert.equal(view.today,'2026-10-23');
    assert.equal(view.slots.length,8);
    assert.equal(view.pauses.length,1);
    assert.equal(view.events.length,6);
  }finally{f.sql.close();}
});

test('rerunning the migration keeps a cancelled initial pause cancelled',async()=>{
  const f=fixture();try {
    assert.equal((await f.schedule('DELETE',undefined,{path:'/league-break-2026-10-24'})).status,200);
    f.sql.exec(migration);
    assert.equal((await ensureWeekend(f.db,clock)).events.length,8);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM war_schedule_pauses').get().n,1);
    assert.notEqual(f.sql.prepare('SELECT disabled_at FROM war_schedule_pauses').get().disabled_at,null);
  }finally{f.sql.close();}
});
