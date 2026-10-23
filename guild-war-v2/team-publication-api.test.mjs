import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {teamPublicationApi, publicationSnapshot, discordWebhookPayload} from "./team-publication-api.mjs";
import {sha256} from "./discord-oauth.mjs";

async function fixture(game="game") {
 const sql = new DatabaseSync(":memory:");
 for (const name of ["001_registration.sql","004_organizer_auth.sql","005_team_drafts.sql","006_team_publications.sql"]) sql.exec(readFileSync(new URL(name,import.meta.url),"utf8"));
 const db={prepare(query){return {bind(...args){return {
  async first(){return sql.prepare(query).get(...args)||null;},
  async all(){return {results:sql.prepare(query).all(...args)};},
  async run(){return {meta:sql.prepare(query).run(...args)};}
 };}};}};
 sql.prepare("INSERT INTO games VALUES (?,'Game')").run(game);
 if(game==="where-winds-meet")for(const name of ["009_weekend_registration.sql","013_war_schedule.sql"])sql.exec(readFileSync(new URL(name,import.meta.url),"utf8"));
 sql.prepare("INSERT INTO players VALUES (?,'player','Hero','HeroNick',1,1)").run(game);
 const startsAt=game==="where-winds-meet"?"2026-10-24T12:30:00Z":"2026-09-06T12:00:00Z";
 sql.prepare("INSERT INTO events VALUES (?,'event',?,?,?,'League','open',30)").run(game,startsAt,startsAt.slice(0,10),game==="where-winds-meet"?"2026-10-19":"2026-08-31");
 sql.prepare("INSERT INTO attendance_choices VALUES (?,'event','player','attending','Tank','PRIVATE NOTE',1,'now','PRIVATE ACTOR')").run(game);
 sql.exec("INSERT INTO organizers VALUES ('organizer','Organizer',1,'now')");
 sql.prepare("INSERT INTO organizer_sessions VALUES (?,?,?,?)").run(await sha256("session"),"organizer","2099-01-01","now");
 sql.prepare("INSERT INTO team_drafts VALUES (?,?,?,?,?,?)").run(game,"event","organizer",1,JSON.stringify({player:{team:"ATTACK_1",loadout:"",tower:"TOP",jungle:"ALLY_TOP"}}),"now");
 const env={GUILD_WAR_DB:db},base=`https://preview.example/api/v2/games/${game}/war/events/event/publications`;
 const post=(revision=1,headers={})=>teamPublicationApi(new Request(base,{method:"POST",headers:{Origin:"https://preview.example",Cookie:"pom_organizer_session=session",...headers},body:JSON.stringify({revision})}),env);
 const get=(id)=>teamPublicationApi(new Request(base+"/"+id),env);
 return {sql,post,get,env,base};
}

test("publishes immutable public snapshots and retries return the same link",async()=>{
 const f=await fixture();
 try {
  const response=await f.post();assert.equal(response.status,200);
  const {id,webhook}=await response.json();assert.equal(webhook,"unconfigured");
  assert.equal((await (await f.post()).json()).id,id);
  const original=await (await f.get(id)).json();
  assert.equal(original.members[0].name,"Hero");assert.equal(original.members[0].tower,"TOP");
  assert.doesNotMatch(JSON.stringify(original),/PRIVATE|organizer|player_id/);
  f.sql.exec("UPDATE players SET character_name='Renamed'; UPDATE team_drafts SET revision=2,board_json='{}'");
  assert.deepEqual(await (await f.get(id)).json(),original);
  assert.equal((await f.post(2)).status,409);
 } finally {f.sql.close();}
});

test("builds a compact Discord payload without private registration data",()=>{
 const snapshot={event:{startsAt:"2026-09-06T12:00:00Z",warType:"League"},members:[{name:"@Hero",team:"ATTACK_1",role:"Tank"}],unassignedCount:0};
 const payload=discordWebhookPayload(snapshot,"https://pathofmemories.com/published/example");
 assert.equal(payload.embeds[0].fields.length,7);
 assert.match(payload.embeds[0].fields[0].value,/@\u200bHero/);
 assert.match(payload.embeds[0].description,/pathofmemories\.com/);
 assert.doesNotMatch(JSON.stringify(payload),/PRIVATE|player_id/);
});

test("keeps the saved player order inside a team",()=>{
 const source={event:{starts_at:"2026-09-06T12:00:00Z",war_type:"League"},registrations:[
  {player_id:"a",character_name:"First",loadouts:[]},{player_id:"b",character_name:"Second",loadouts:[]}
 ]};
 const snapshot=publicationSnapshot({a:{team:"ATTACK_1",loadout:"",position:1},b:{team:"ATTACK_1",loadout:"",position:0}},source);
 assert.deepEqual(snapshot.members.map(member=>member.name),["Second","First"]);
});

test("requires organizer, same-origin writes and current saved revision",async()=>{
 const f=await fixture();
 try {
  assert.equal((await f.post(1,{Cookie:""})).status,401);
  assert.equal((await f.post(1,{Origin:"https://other.example"})).status,403);
  assert.equal((await f.post(9)).status,409);
  f.sql.exec("UPDATE organizers SET enabled=0");
  assert.equal((await f.post()).status,401);
 } finally {f.sql.close();}
});

test("changed attendance and cancelled rounds cannot be published",async()=>{
 const f=await fixture();
 try {
  f.sql.exec("UPDATE attendance_choices SET status='unavailable'");
  assert.equal((await f.post()).status,409);
  f.sql.exec("UPDATE attendance_choices SET status='attending'; UPDATE events SET status='cancelled'");
  assert.equal((await f.post()).status,409);
 } finally {f.sql.close();}
});

test("rejects invalid overfull boards and unknown loadouts",()=>{
 const source={event:{},registrations:Array.from({length:6},(_,i)=>({player_id:"p"+i,character_name:"Hero",loadouts:[]}))};
 const board=Object.fromEntries(source.registrations.map(p=>[p.player_id,{team:"ATTACK_1",loadout:""}]));
 assert.throws(()=>publicationSnapshot(board,source),/invalid_board/);
 assert.throws(()=>publicationSnapshot({p0:{team:"ATTACK_1",loadout:"unknown"}},source),/roster_changed/);
});

test("public links are scoped to their game and event",async()=>{
 const f=await fixture();
 try {
  const {id}=await (await f.post()).json();
  const wrong=f.base.replace("/game/","/other/")+"/"+id;
  assert.equal((await teamPublicationApi(new Request(wrong),f.env)).status,404);
 } finally {f.sql.close();}
});

test("rejects a new publication for a paused League event",async()=>{
 const f=await fixture("where-winds-meet");
 try {
  const response=await f.post();
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:"event_paused",eventId:"event"});
  assert.equal(f.sql.prepare("SELECT count(*) AS count FROM team_publications").get().count,0);
 }finally{f.sql.close();}
});

test("existing snapshots and retries stay available when a round is paused",async()=>{
 const f=await fixture("where-winds-meet");
 try {
  f.sql.exec("UPDATE war_schedule_pauses SET disabled_at='2026-10-23'");
  const published=await f.post();
  assert.equal(published.status,200);
  const {id}=await published.json();
  f.sql.exec("UPDATE war_schedule_pauses SET disabled_at=NULL; UPDATE team_drafts SET revision=2");
  assert.deepEqual(await (await f.post()).json(),{id,webhook:"already_published"});
  assert.equal((await f.get(id)).status,200);
  const response=await f.post(2);
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:"event_paused",eventId:"event"});
  assert.equal(f.sql.prepare("SELECT count(*) AS count FROM team_publications").get().count,1);
 }finally{f.sql.close();}
});
