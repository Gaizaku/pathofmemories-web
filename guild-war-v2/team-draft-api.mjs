import {activeOrganizer} from "./organizer-auth.mjs";
import {readApi} from './read-api.mjs';
const teams = ["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const jungle = ["ENEMY_TOP","ENEMY_BOTTOM","ALLY_TOP","ALLY_BOTTOM"];
const lanes = ["TOP","MID","BOTTOM"];
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export function validDraft(value) {
 if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||!value.board||Array.isArray(value.board)||typeof value.board!=="object")return false;
 const entries=Object.entries(value.board),counts={},teamCounts={};
 if(entries.length>200)return false;
 for(const [id,p] of entries){
  if(!/^[A-Za-z0-9-]{1,64}$/.test(id)||!p||!teams.includes(p.team)||typeof p.loadout!=="string"||p.loadout.length>64)return false;
  if(p.jungle!==undefined&&!jungle.includes(p.jungle))return false;
  if(p.tower!==undefined&&!lanes.includes(p.tower))return false;
  if(p.position!==undefined&&(!Number.isSafeInteger(p.position)||p.position<0||p.position>200))return false;
  if(p.towerPosition!==undefined&&(!Number.isSafeInteger(p.towerPosition)||p.towerPosition<0||p.towerPosition>2))return false;
  if(!p.tower&&p.towerPosition!==undefined)return false;
  if(p.team==="STANDBY"&&(p.jungle||p.tower))return false;
  if(p.team!=="STANDBY"){teamCounts[p.team]=(teamCounts[p.team]||0)+1;if(teamCounts[p.team]>5)return false;}
  if(p.tower){counts[p.tower]=(counts[p.tower]||0)+1;if(counts[p.tower]>3)return false;}
 }
 return true;
}
export async function teamDraftApi(request,env){
 const url=new URL(request.url),draftMatch=/^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/draft$/.exec(url.pathname),builderMatch=/^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/team-builder$/.exec(url.pathname),quickMatch=/^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/quick-player$/.exec(url.pathname),cancelMatch=/^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/registrations\/([A-Za-z0-9-]{1,64})$/.exec(url.pathname),match=draftMatch||builderMatch||quickMatch||cancelMatch;
 if(!match)return null;
 if(builderMatch&&request.method!=="GET")return json({error:"method_not_allowed"},405);
 if(draftMatch&&!["GET","PUT"].includes(request.method))return json({error:"method_not_allowed"},405);
 if(quickMatch&&request.method!=="POST")return json({error:"method_not_allowed"},405);
 if(cancelMatch&&request.method!=="DELETE")return json({error:"method_not_allowed"},405);
 if(((draftMatch&&request.method==="PUT")||quickMatch||cancelMatch)&&request.headers.get("Origin")!==url.origin)return json({error:"origin_required"},403);
 try{
  const user=await activeOrganizer(env,request);
  const db=env.GUILD_WAR_DB,[,game,event]=match;
  if(quickMatch){
   if(!user)return json({error:"organizer_required"},401);
   const raw=await request.text();
   if(raw.length>2000)return json({error:"too_large"},413);
   let data;try{data=JSON.parse(raw);}catch{return json({error:"invalid_player"},400);}
   const requestedPlayerId=typeof data?.playerId==="string"?data.playerId.trim():"";
   const name=typeof data?.characterName==="string"?data.characterName.trim():"";
   const nickname=typeof data?.nickname==="string"?data.nickname.trim():"";
   const preferredRole=typeof data?.preferredRole==="string"?data.preferredRole.trim():"";
   if(requestedPlayerId&&!/^[A-Za-z0-9-]{1,64}$/.test(requestedPlayerId))return json({error:"invalid_player"},400);
   if((!requestedPlayerId&&!name)||name.length>64||nickname.length>64||preferredRole&&!["Tank","Heal","DPS"].includes(preferredRole))return json({error:"invalid_player"},400);
   const eventRow=await db.prepare("SELECT id,status FROM events WHERE game_id=? AND id=?").bind(game,event).first();
   if(!eventRow)return json({error:"event_not_found"},404);
   if(eventRow.status!=="open")return json({error:"registration_closed"},409);
   if(requestedPlayerId){
    const existing=await db.prepare("SELECT p.id,p.character_name,p.nickname,COALESCE(m.preferred_team,'') AS preferred_team FROM players p LEFT JOIN member_preferences m ON m.game_id=p.game_id AND m.player_id=p.id WHERE p.game_id=? AND p.id=? AND p.active=1").bind(game,requestedPlayerId).first();
    if(!existing)return json({error:"player_not_found"},404);
    const choice=await db.prepare("SELECT status,preferred_role FROM attendance_choices WHERE game_id=? AND event_id=? AND player_id=?").bind(game,event,requestedPlayerId).first();
    if(choice?.status==="attending")return json({error:"already_registered"},409);
    const effectiveRole=preferredRole||choice?.preferred_role||"";
    const now=new Date().toISOString();
    await db.batch([
     db.prepare("INSERT INTO attendance_choices (game_id,event_id,player_id,status,preferred_role,note,updated_at,updated_by) VALUES (?,?,?,'attending',?,?,?,'organizer') ON CONFLICT(game_id,event_id,player_id) DO UPDATE SET status='attending',preferred_role=excluded.preferred_role,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by,revision=attendance_choices.revision+1").bind(game,event,requestedPlayerId,effectiveRole,"",now),
     db.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)").bind(game,user.id,"quick_player_registered",requestedPlayerId+":"+event,now)
    ]);
    const loadouts=await db.prepare("SELECT l.id,l.role,main.name AS main_weapon_name,sub.name AS sub_weapon_name FROM loadouts l JOIN weapons main ON main.game_id=l.game_id AND main.id=l.main_weapon_id JOIN weapons sub ON sub.game_id=l.game_id AND sub.id=l.sub_weapon_id WHERE l.game_id=? AND l.player_id=? AND l.active=1 ORDER BY l.id").bind(game,requestedPlayerId).all();
    return json({player:{player_id:existing.id,character_name:existing.character_name,nickname:existing.nickname||"",preferred_role:effectiveRole,note:"",preferred_team:existing.preferred_team||"",loadouts:loadouts.results||[]},eventId:event});
   }
   if(!name||name.length>64||nickname.length>64)return json({error:"invalid_player"},400);
   const duplicateResult=await db.prepare("SELECT id FROM players WHERE game_id=? AND active=1 AND lower(character_name)=lower(?)").bind(game,name).all();
   if(duplicateResult.results?.length)return json({error:"name_exists"},409);
   const playerId=crypto.randomUUID(),now=new Date().toISOString();
   await db.batch([
    db.prepare("INSERT INTO players (game_id,id,character_name,nickname) VALUES (?,?,?,?)").bind(game,playerId,name,nickname),
    db.prepare("INSERT INTO attendance_choices (game_id,event_id,player_id,status,preferred_role,note,updated_at,updated_by) VALUES (?,?,?,'attending',?,?,?,'organizer')").bind(game,event,playerId,preferredRole,"",now),
    db.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)").bind(game,user.id,"quick_player_added",playerId,now)
   ]);
   return json({player:{player_id:playerId,character_name:name,nickname,preferred_role:preferredRole,note:"",preferred_team:"",loadouts:[]},eventId:event},201);
  }
  if(cancelMatch){
   if(!user)return json({error:"organizer_required"},401);
   const playerId=cancelMatch[3];
   const player=await db.prepare("SELECT id FROM players WHERE game_id=? AND id=? AND active=1").bind(game,playerId).first();
   if(!player)return json({error:"player_not_found"},404);
   const eventRow=await db.prepare("SELECT id FROM events WHERE game_id=? AND id=?").bind(game,event).first();
   if(!eventRow)return json({error:"event_not_found"},404);
   const draft=await db.prepare("SELECT revision,board_json FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=?").bind(game,event,user.id).first();
   let draftBoard=null,draftRevision=null,draftUpdate=null;
   if(draft){
    try{
     draftBoard=JSON.parse(draft.board_json);
     if(draftBoard&&typeof draftBoard==="object"&&!Array.isArray(draftBoard)&&Object.prototype.hasOwnProperty.call(draftBoard,playerId)){
      delete draftBoard[playerId];
      draftRevision=draft.revision+1;
      draftUpdate=db.prepare("UPDATE team_drafts SET revision=revision+1,board_json=?,updated_at=? WHERE game_id=? AND event_id=? AND organizer_id=? AND revision=?").bind(JSON.stringify(draftBoard),new Date().toISOString(),game,event,user.id,draft.revision);
     }else draftRevision=draft.revision;
    }catch{draftBoard=null;draftRevision=draft.revision;}
   }
   const now=new Date().toISOString();
   const statements=[
    db.prepare("INSERT INTO attendance_choices (game_id,event_id,player_id,status,preferred_role,note,updated_at,updated_by) VALUES (?,?,?,'unavailable',NULL,'',?,'organizer') ON CONFLICT(game_id,event_id,player_id) DO UPDATE SET status=excluded.status,preferred_role=excluded.preferred_role,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by,revision=attendance_choices.revision+1").bind(game,event,playerId,now),
    db.prepare("DELETE FROM attendance_loadouts WHERE game_id=? AND event_id=? AND player_id=?").bind(game,event,playerId),
    db.prepare("INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?)").bind(game,user.id,"registration_cancelled",playerId+":"+event,now)
   ];
   if(draftUpdate)statements.push(draftUpdate);
   await db.batch(statements);
   return json({ok:true,playerId,eventId:event,draftRevision,draftBoard});
  }
  if(builderMatch){
   if(!user)return json({error:"organizer_required"},401);
   const [rosterResponse,draft]=await Promise.all([
    readApi(new Request(url.origin+'/api/v2/games/'+game+'/war/events/'+event+'/registrations'),env),
    db.prepare("SELECT revision,board_json,updated_at FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=?").bind(game,event,user.id).first()
   ]);
   if(!rosterResponse.ok)return rosterResponse;
   const roster=await rosterResponse.json();
   return json({...roster,organizer:user?{displayName:user.displayName}:null,revision:draft?.revision||0,board:draft?JSON.parse(draft.board_json):{},updatedAt:draft?.updated_at||null});
  }
  if(!user)return json({error:"organizer_required"},401);
  const exists=await db.prepare("SELECT id FROM events WHERE game_id=? AND id=?").bind(game,event).first();
  if(!exists)return json({error:"event_not_found"},404);
  if(request.method==="GET"){
   const row=await db.prepare("SELECT revision,board_json,updated_at FROM team_drafts WHERE game_id=? AND event_id=? AND organizer_id=?").bind(game,event,user.id).first();
   return json(row?{revision:row.revision,board:JSON.parse(row.board_json),updatedAt:row.updated_at}:{revision:0,board:{}});
  }
  const raw=await request.text();
  if(raw.length>100000)return json({error:"too_large"},413);
  let data;try{data=JSON.parse(raw);}catch{return json({error:"invalid_draft"},400);}
  if(!validDraft(data))return json({error:"invalid_draft"},400);
  const rosterResponse=await readApi(new Request(url.origin+'/api/v2/games/'+game+'/war/events/'+event+'/registrations'),env);
  if(!rosterResponse.ok)return json({error:'temporarily_unavailable'},503);
  const roster=(await rosterResponse.json()).registrations;
  for(const [id,p] of Object.entries(data.board))if(!roster.some(r=>r.player_id===id&&(p.loadout===''?r.loadouts.length===0:r.loadouts.some(l=>l.id===p.loadout))))return json({error:'roster_changed'},409);
  const now=new Date().toISOString(),board=JSON.stringify(data.board);
  // Compare and swap prevents a stale browser from overwriting a newer draft.
  const result=data.revision===0
   ?await db.prepare("INSERT INTO team_drafts VALUES (?,?,?,1,?,?) ON CONFLICT(game_id,event_id,organizer_id) DO NOTHING").bind(game,event,user.id,board,now).run()
   :await db.prepare("UPDATE team_drafts SET revision=revision+1,board_json=?,updated_at=? WHERE game_id=? AND event_id=? AND organizer_id=? AND revision=?").bind(board,now,game,event,user.id,data.revision).run();
  if(result.meta.changes!==1)return json({error:"draft_conflict"},409);
  return json({revision:data.revision+1,updatedAt:now});
 }catch{return json({error:"temporarily_unavailable"},503);}
}
