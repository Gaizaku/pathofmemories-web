import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {teamPublicationApi, publicationSnapshot} from "./team-publication-api.mjs";
import {sha256} from "./discord-oauth.mjs";

async function fixture() {
 const sql = new DatabaseSync(":memory:");
 for (const name of ["001_registration.sql","004_organizer_auth.sql","005_team_drafts.sql","006_team_publications.sql"]) sql.exec(readFileSync(new URL(name,import.meta.url),"utf8"));
 const db={prepare(query){return {bind(...args){return {
  async first(){return sql.prepare(query).get(...args)||null;},
  async all(){return {results:sql.prepare(query).all(...args)};},
  async run(){return {meta:sql.prepare(query).run(...args)};}
 };}};}};
 sql.exec(`INSERT INTO games VALUES ('game','Game');
 INSERT INTO players VALUES ('game','player','Hero',1,1);
 INSERT INTO events VALUES ('game','event','2026-09-06T12:00:00Z','2026-09-06','2026-08-31','League','open',30);
 INSERT INTO attendance_choices VALUES ('game','event','player','attending','Tank','PRIVATE NOTE',1,'now','PRIVATE ACTOR');
 INSERT INTO organizers VALUES ('organizer','Organizer',1,'now');`);
 sql.prepare("INSERT INTO organizer_sessions VALUES (?,?,?,?)").run(await sha256("session"),"organizer","2099-01-01","now");
 sql.prepare("INSERT INTO team_drafts VALUES (?,?,?,?,?,?)").run("game","event","organizer",1,JSON.stringify({player:{team:"ATTACK_1",loadout:"",tower:"TOP",jungle:"ALLY_TOP"}}),"now");
 const env={GUILD_WAR_DB:db},base="https://preview.example/api/v2/games/game/war/events/event/publications";
 const post=(revision=1,headers={})=>teamPublicationApi(new Request(base,{method:"POST",headers:{Origin:"https://preview.example",Cookie:"pom_organizer_session=session",...headers},body:JSON.stringify({revision})}),env);
 const get=(id)=>teamPublicationApi(new Request(base+"/"+id),env);
 return {sql,post,get,env,base};
}

test("publishes immutable public snapshots and retries return the same link",async()=>{
 const f=await fixture();
 try {
  const response=await f.post();assert.equal(response.status,200);
  const {id}=await response.json();
  assert.equal((await (await f.post()).json()).id,id);
  const original=await (await f.get(id)).json();
  assert.equal(original.members[0].name,"Hero");assert.equal(original.members[0].tower,"TOP");
  assert.doesNotMatch(JSON.stringify(original),/PRIVATE|organizer|player_id/);
  f.sql.exec("UPDATE players SET character_name='Renamed'; UPDATE team_drafts SET revision=2,board_json='{}'");
  assert.deepEqual(await (await f.get(id)).json(),original);
  assert.equal((await f.post(2)).status,409);
 } finally {f.sql.close();}
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

test("rejects overfull squads and unknown loadouts",()=>{
 const source={event:{},registrations:Array.from({length:6},(_,i)=>({player_id:"p"+i,character_name:"Hero",loadouts:[]}))};
 const board=Object.fromEntries(source.registrations.map(p=>[p.player_id,{team:"ATTACK_1",loadout:""}]));
 assert.throws(()=>publicationSnapshot(board,source),/squad_full/);
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
