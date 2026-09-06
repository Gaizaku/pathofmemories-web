import {activeOrganizer} from "./organizer-auth.mjs";
const teams = ["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const jungle = ["ENEMY_TOP","ENEMY_BOTTOM","ALLY_TOP","ALLY_BOTTOM"];
const lanes = ["TOP","MID","BOTTOM"];
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export function validDraft(value) {
 if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||!value.board||Array.isArray(value.board)||typeof value.board!=="object")return false;
 const entries=Object.entries(value.board),counts={};
 if(entries.length>200)return false;
 for(const [id,p] of entries){
  if(!/^[A-Za-z0-9-]{1,64}$/.test(id)||!p||!teams.includes(p.team)||typeof p.loadout!=="string"||p.loadout.length>64)return false;
  if(p.jungle!==undefined&&!jungle.includes(p.jungle))return false;
  if(p.tower!==undefined&&!lanes.includes(p.tower))return false;
  if(p.team==="STANDBY"&&(p.jungle||p.tower))return false;
  if(p.tower){counts[p.tower]=(counts[p.tower]||0)+1;if(counts[p.tower]>3)return false;}
 }
 return true;
}
export async function teamDraftApi(request,env){
 const url=new URL(request.url),match=/^\/api\/v2\/games\/([a-z0-9-]{1,64})\/war\/events\/([A-Za-z0-9-]{1,64})\/draft$/.exec(url.pathname);
 if(!match)return null;
 if(!["GET","PUT"].includes(request.method))return json({error:"method_not_allowed"},405);
 if(request.method==="PUT"&&request.headers.get("Origin")!==url.origin)return json({error:"origin_required"},403);
 try{
  const user=await activeOrganizer(env,request);
  if(!user)return json({error:"organizer_required"},401);
  const db=env.GUILD_WAR_DB,[,game,event]=match;
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
  const owned=await db.prepare("SELECT c.player_id,l.id AS loadout_id FROM attendance_choices c LEFT JOIN attendance_loadouts a ON a.game_id=c.game_id AND a.event_id=c.event_id AND a.player_id=c.player_id LEFT JOIN loadouts l ON l.game_id=a.game_id AND l.id=a.loadout_id AND l.player_id=c.player_id AND l.active=1 WHERE c.game_id=? AND c.event_id=? AND c.status='attending'").bind(game,event).all();
  for(const [id,p] of Object.entries(data.board))if(!owned.results.some(r=>r.player_id===id&&(p.loadout===""?r.loadout_id===null:r.loadout_id===p.loadout)))return json({error:"roster_changed"},409);
  const now=new Date().toISOString(),board=JSON.stringify(data.board);
  // Compare and swap prevents a stale browser from overwriting a newer draft.
  const result=data.revision===0
   ?await db.prepare("INSERT INTO team_drafts VALUES (?,?,?,1,?,?) ON CONFLICT(game_id,event_id,organizer_id) DO NOTHING").bind(game,event,user.id,board,now).run()
   :await db.prepare("UPDATE team_drafts SET revision=revision+1,board_json=?,updated_at=? WHERE game_id=? AND event_id=? AND organizer_id=? AND revision=?").bind(board,now,game,event,user.id,data.revision).run();
  if(result.meta.changes!==1)return json({error:"draft_conflict"},409);
  return json({revision:data.revision+1,updatedAt:now});
 }catch{return json({error:"temporarily_unavailable"},503);}
}
