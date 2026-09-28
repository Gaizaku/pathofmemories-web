import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {readApi} from './read-api.mjs';
import {GAME} from './weekend.mjs';

function fixture(){
  const sql=new DatabaseSync(':memory:');
  for(const file of ['001_registration.sql','009_weekend_registration.sql'])sql.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
  sql.exec(`
    INSERT INTO games VALUES ('${GAME}','WWM');
    INSERT INTO players (game_id,id,character_name,nickname) VALUES
      ('${GAME}','member-regular','Member Regular','Golf'),
      ('${GAME}','organizer-regular','Organizer Regular','');
    INSERT INTO events (game_id,id,starts_at,local_date,week_start,war_type,status,capacity) VALUES
      ('${GAME}','old-round','2026-09-05T12:30:00Z','2026-09-05','2026-08-31','League','closed',30),
      ('${GAME}','current-round','2026-09-12T12:30:00Z','2026-09-12','2026-09-07','League','open',30),
      ('${GAME}','current-other-round','2026-09-12T13:00:00Z','2026-09-12','2026-09-07','Rank','open',30);
    INSERT INTO regular_rules (game_id,player_id,enabled) VALUES ('${GAME}','organizer-regular',1);
    INSERT INTO regular_slots (game_id,player_id,weekday,war_type) VALUES ('${GAME}','organizer-regular',6,'League');
  `);
  sql.prepare(`INSERT INTO member_preferences
    (game_id,player_id,token_hash,regular,slots_json,loadouts_json,updated_at,operation_id)
    VALUES (?,?,?,?,?,?,?,?)`).run(GAME,'member-regular','token-hash',1,'["6:1"]','[]','2026-09-01T00:00:00Z','op-member');
  for(const playerId of ['member-regular','organizer-regular']){
    sql.prepare(`INSERT INTO attendance_choices
      (game_id,event_id,player_id,status,note,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?)`).run(GAME,'old-round',playerId,'attending',`Note for ${playerId}`,'2026-09-05T12:00:00Z','member');
    sql.prepare(`INSERT INTO attendance_choices
      (game_id,event_id,player_id,status,note,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?)`).run(GAME,'current-other-round',playerId,'attending','','2026-09-12T11:00:00Z','organizer');
  }
  const db={prepare(query){return {bind(...args){return {all:async()=>({success:true,results:sql.prepare(query).all(...args)}),first:async()=>sql.prepare(query).get(...args)||null};}};}};
  return {sql,env:{GUILD_WAR_DB:db}};
}

test('returns saved notes for both member and organizer regular attendees in Team Builder',async()=>{
  const f=fixture();
  try{
    const response=await readApi(new Request(`https://example.com/api/v2/games/${GAME}/war/events/current-round/registrations`),f.env);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.deepEqual(body.registrations.map(({player_id,note,attendance_status})=>({player_id,note,attendance_status})),[
      {player_id:'member-regular',note:'Note for member-regular',attendance_status:'expected'},
      {player_id:'organizer-regular',note:'Note for organizer-regular',attendance_status:'expected'},
    ]);
    f.sql.prepare(`UPDATE attendance_choices SET note='',updated_at=?,updated_by='member'
      WHERE game_id=? AND event_id=? AND player_id=?`).run('2026-09-12T12:00:00Z',GAME,'current-other-round','member-regular');
    const updated=await readApi(new Request(`https://example.com/api/v2/games/${GAME}/war/events/current-round/registrations`),f.env);
    const updatedBody=await updated.json();
    assert.equal(updatedBody.registrations.find(player=>player.player_id==='member-regular').note,'');
    assert.equal(updatedBody.registrations.find(player=>player.player_id==='organizer-regular').note,'Note for organizer-regular');
  }finally{f.sql.close();}
});
