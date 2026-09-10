import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {memberRegistration} from './member-registration.mjs';
import {readApi} from './read-api.mjs';
import {GAME,ensureWeekend,slotOf,validSlots} from './weekend.mjs';
const clock=new Date('2026-09-08T10:00:00Z');
function fixture(){
 const sql=new DatabaseSync(':memory:');
 for(const f of ['001_registration.sql','002_registration_claims.sql','009_weekend_registration.sql'])sql.exec(readFileSync(new URL(f,import.meta.url),'utf8'));
 sql.exec(`INSERT INTO games VALUES ('${GAME}','WWM'); INSERT INTO players (game_id,id,character_name,nickname) VALUES ('${GAME}','p1','Hero','Golf'); INSERT INTO weapons VALUES ('${GAME}','w1','Sword'),('${GAME}','w2','Spear'); INSERT INTO loadouts (game_id,id,player_id,role,main_weapon_id,sub_weapon_id) VALUES ('${GAME}','l1','p1','DPS','w1','w2');`);
 const db={prepare(query){return {bind(...args){return {all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:sql.prepare(query).run(...args)}),first:async()=>sql.prepare(query).get(...args)};}};},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={GUILD_WAR_DB:db};
 const post=(action,body,origin='https://example.com')=>memberRegistration(new Request('https://example.com/api/v2/games/'+GAME+'/member-registration/'+action,{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),env,clock);
 return {sql,db,env,post};
}
test('weekends contain exactly four rounds each; normalization preserves IDs and history',async()=>{
 const f=fixture();try{
 f.sql.exec(`INSERT INTO events VALUES ('${GAME}','legacy','2026-09-12T20:05:00+07:00','2026-09-12','2026-09-07','Matching','open',30);`);
 const a=await ensureWeekend(f.db,new Date('2026-09-08T10:00:00Z'));
 assert.equal(a.events.length,8);assert.deepEqual(a.events.slice(0,4).map(e=>e.war_type),['League','Rank','Rank','Rank']);assert.equal(a.events[1].id,'legacy');assert.equal(slotOf(a.events[1]),'6:2');
 await ensureWeekend(f.db,new Date('2026-09-08T10:00:00Z'));assert.equal(f.sql.prepare('SELECT count(*) AS n FROM events').get().n,8);
 }finally{f.sql.close();}
});
test('saves a whole week, remembers exact slots, rejects stale writes, and withdrawals beat regulars',async()=>{
 const f=fixture();try{
 const {events,weekStart}=await ensureWeekend(f.db,clock);
 const selected=events.filter(e=>new Date(e.starts_at)>clock).slice(0,2).map(e=>e.id);
 const body={playerId:'p1',weekStart,selected,loadoutIds:['l1'],preferredRole:'DPS',preferredTeam:'ATTACK_1',note:'Hello',regular:true,revision:0};
 const save=await f.post('save',body);assert.equal(save.status,200);const claim=await save.json();
 assert.equal(f.sql.prepare("SELECT count(*) AS n FROM attendance_choices WHERE status='attending'").get().n,selected.length);
 assert.equal((await f.post('save',body)).status,409);
 const loaded=await (await f.post('lookup',{playerId:'p1',token:claim.token})).json();assert.deepEqual(loaded.selected,selected);assert.deepEqual(loaded.regularSlots,selected);
 const update=await f.post('save',{...body,token:claim.token,revision:1,selected:[],regular:true,regularSlots:selected});assert.equal(update.status,200);
 const temporary=await (await f.post('lookup',{playerId:'p1',token:claim.token})).json();assert.deepEqual(temporary.selected,[]);assert.deepEqual(temporary.regularSlots,selected);
 assert.equal((await f.post('save',{...body,token:claim.token,revision:1})).status,409);
 assert.equal(f.sql.prepare("SELECT count(*) AS n FROM attendance_choices WHERE status='attending'").get().n,0);
 const e=events.find(e=>selected.includes(e.id));f.sql.prepare('DELETE FROM attendance_choices').run();f.sql.prepare('UPDATE member_preferences SET regular=1,slots_json=?').run(JSON.stringify([slotOf(e)]));
 const url='https://example.com/api/v2/games/'+GAME+'/war/events/'+e.id+'/registrations';
 const roster=await (await readApi(new Request(url),f.env)).json();assert.equal(roster.registrations[0].attendance_status,'expected');assert.equal(roster.registrations[0].loadouts[0].id,'l1');
 f.sql.prepare('INSERT INTO attendance_choices (game_id,event_id,player_id,status,updated_at,updated_by) VALUES (?,?,?,?,?,?)').run(GAME,e.id,'p1','unavailable','now','member');
 assert.equal((await (await readApi(new Request(url),f.env)).json()).registrations.length,0);
 }finally{f.sql.close();}
});
test('rejects invalid slots and cross-origin changes',async()=>{
 assert.equal(validSlots(['6:2','6:3','0:4']),true);assert.equal(validSlots(['6:2','6:2']),false);assert.equal(validSlots(['5:1']),false);
 const f=fixture();try{assert.equal((await f.post('save',{},'https://evil.example')).status,403);}finally{f.sql.close();}
});
test('allows a member to be opened and updated from another device',async()=>{
 const f=fixture();try{
  const {events,weekStart}=await ensureWeekend(f.db,clock);
  const selected=[events[0].id];
  const body={playerId:'p1',weekStart,selected,loadoutIds:['l1'],preferredRole:'DPS',preferredTeam:'ATTACK_1',note:'',regular:false,revision:0};
  assert.equal((await f.post('save',body)).status,200);
  const lookup=await f.post('lookup',{playerId:'p1'});assert.equal(lookup.status,200);
  const profile=await lookup.json();assert.equal(profile.revision,1);
  assert.equal((await f.post('save',{...body,selected:[],revision:profile.revision})).status,200);
 }finally{f.sql.close();}
});
