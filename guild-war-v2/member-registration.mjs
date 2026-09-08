import {createClaimToken,hashClaimToken,hasMatchingClaim} from './registration-token.mjs';
import {GAME,rows,ensureWeekend,slotOf,validSlots} from './weekend.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const teams=['','ATTACK_1','ATTACK_2','ATTACK_3','DEFENSE_1','DEFENSE_2','FOREST','STANDBY'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(value);

export async function memberRegistration(request,env,clock=new Date()) {
  const url=new URL(request.url),base='/api/v2/games/'+GAME+'/member-registration';
  if(!url.pathname.startsWith(base))return null;
  const action=url.pathname.slice(base.length);
  if(!['','/lookup','/save','/player','/loadout','/claim'].includes(action))return json({error:'not_found'},404);
  const db=env.GUILD_WAR_DB;
  try {
    if(action===''&&request.method==='GET')return json(await ensureWeekend(db,clock));
    if(request.method!=='POST')return json({error:'method_not_allowed'},405);
    if(request.headers.get('Origin')!==url.origin)return json({error:'invalid_origin'},403);
    const raw=await request.text();if(raw.length>16000)return json({error:'too_large'},413);
    let data;try{data=JSON.parse(raw);}catch{return json({error:'invalid_request'},400);}
    if(!data||typeof data!=='object')return json({error:'invalid_request'},400);
    if(action==='/player') {
      const name=data.characterName?.trim(),nickname=data.nickname?.trim();
      if(typeof name!=='string'||!name||name.length>64||typeof nickname!=='string'||nickname.length>64)return json({error:'invalid_player'},400);
      if((await rows(db,'SELECT id FROM players WHERE game_id=? AND lower(character_name)=lower(?)',GAME,name)).length)return json({error:'name_exists'},409);
      const playerId=crypto.randomUUID(),token=createClaimToken(),now=new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO players (game_id,id,character_name,nickname) VALUES (?,?,?,?)').bind(GAME,playerId,name,nickname),
        db.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,updated_at,operation_id) VALUES (?,?,?,?,?)').bind(GAME,playerId,await hashClaimToken(token),now,crypto.randomUUID())
      ]);
      return json({playerId,token},201);
    }
    if(!id(data.playerId))return json({error:'invalid_player'},400);
    const [player]=await rows(db,'SELECT id FROM players WHERE game_id=? AND id=? AND active=1',GAME,data.playerId);
    if(!player)return json({error:'player_not_found'},404);
    const [profile]=await rows(db,'SELECT * FROM member_preferences WHERE game_id=? AND player_id=?',GAME,data.playerId);
    if(profile&&!await hasMatchingClaim(data.token,profile.token_hash))return json({error:'claim_required'},409);
    // Honor existing per-round edit tokens when moving to a persistent member claim.
    if(!profile) {
      const claims=await rows(db,'SELECT event_id,token_hash FROM registration_claims WHERE game_id=? AND player_id=?',GAME,data.playerId);
      for(const claim of claims)if(!await hasMatchingClaim(data.claims?.[claim.event_id],claim.token_hash))return json({error:'claim_required'},409);
    }
    if(action==='/claim') {
      if(profile)return json({token:data.token,revision:profile.revision});
      const token=createClaimToken();
      await db.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,updated_at,operation_id) VALUES (?,?,?,?,?)').bind(GAME,data.playerId,await hashClaimToken(token),new Date().toISOString(),crypto.randomUUID()).run();
      return json({token,revision:0});
    }
    const owned=await rows(db,'SELECT id,role FROM loadouts WHERE game_id=? AND player_id=? AND active=1',GAME,data.playerId);
    if(action==='/loadout') {
      if(!profile)return json({error:'save_profile_first'},409);
      if(!['Tank','Heal','DPS'].includes(data.role)||!id(data.mainWeapon)||!id(data.subWeapon)||data.mainWeapon===data.subWeapon)return json({error:'invalid_loadout'},400);
      const weapons=await rows(db,'SELECT id FROM weapons WHERE game_id=? AND id IN (?,?)',GAME,data.mainWeapon,data.subWeapon);
      if(weapons.length!==2)return json({error:'invalid_loadout'},400);
      const loadoutId=crypto.randomUUID();
      await db.prepare('INSERT INTO loadouts (game_id,id,player_id,role,main_weapon_id,sub_weapon_id) VALUES (?,?,?,?,?,?)').bind(GAME,loadoutId,data.playerId,data.role,data.mainWeapon,data.subWeapon).run();
      return json({id:loadoutId},201);
    }
    const {events,weekStart}=await ensureWeekend(db,clock);
    if(action==='/lookup') {
      const choices=await rows(db,'SELECT c.event_id,c.status,c.preferred_role,c.note FROM attendance_choices c JOIN events e ON e.game_id=c.game_id AND e.id=c.event_id WHERE c.game_id=? AND c.player_id=? AND e.week_start=?',GAME,data.playerId,weekStart);
      const defaults=profile?.regular?JSON.parse(profile.slots_json):[];
      const selected=events.filter(e=>{const choice=choices.find(c=>c.event_id===e.id);return choice?choice.status==='attending':defaults.includes(e.slot);}).map(e=>e.id);
      const legacy=profile?[]:await rows(db,'SELECT DISTINCT a.loadout_id FROM attendance_loadouts a JOIN events e ON e.game_id=a.game_id AND e.id=a.event_id WHERE a.game_id=? AND a.player_id=? AND e.week_start=?',GAME,data.playerId,weekStart);
      const regularSlots=events.filter(e=>defaults.includes(e.slot)).map(e=>e.id);
      return json({revision:profile?.revision||0,regular:!!profile?.regular,regularSlots,selected,loadoutIds:(profile?JSON.parse(profile.loadouts_json):legacy.map(l=>l.loadout_id)).filter(id=>owned.some(l=>l.id===id)),preferredRole:profile?.preferred_role||choices[0]?.preferred_role||'',preferredTeam:profile?.preferred_team||'',note:choices[0]?.note||'',weapons:await rows(db,'SELECT id,name FROM weapons WHERE game_id=? ORDER BY name',GAME)});
    }
    if(action!=='/save')return json({error:'not_found'},404);
    const {selected,loadoutIds,preferredRole='',preferredTeam='',note='',regular,revision}=data;
    const regularSlots=Array.isArray(data.regularSlots)?data.regularSlots:selected;
    if(!Array.isArray(selected)||selected.length>8||new Set(selected).size!==selected.length||!selected.every(x=>events.some(e=>e.id===x))||!Array.isArray(regularSlots)||regularSlots.length>8||new Set(regularSlots).size!==regularSlots.length||!regularSlots.every(x=>events.some(e=>e.id===x))||!Array.isArray(loadoutIds)||loadoutIds.length>8||new Set(loadoutIds).size!==loadoutIds.length||!loadoutIds.every(x=>owned.some(l=>l.id===x))||!teams.includes(preferredTeam)||typeof regular!=='boolean'||!Number.isSafeInteger(revision)||revision<0||typeof note!=='string'||note.length>500||typeof preferredRole!=='string'||(preferredRole&&!owned.some(l=>l.role===preferredRole&&loadoutIds.includes(l.id))))return json({error:'invalid_request'},400);
    if(data.weekStart!==weekStart)return json({error:'week_changed'},409);
    const open=events.filter(e=>e.status==='open'&&new Date(e.starts_at)>clock);
    if(!open.length)return json({error:'registration_closed'},409);
    const slots=events.filter(e=>regularSlots.includes(e.id)).map(slotOf);
    if(!validSlots(slots))return json({error:'invalid_slots'},400);
    const operation=crypto.randomUUID(),now=new Date().toISOString(),token=profile?data.token:createClaimToken();
    // Every write is guarded by the successful revision change inside one D1 batch.
    const guard='EXISTS (SELECT 1 FROM member_preferences WHERE game_id=? AND player_id=? AND operation_id=?)';
    const guardArgs=[GAME,data.playerId,operation];
    const statements=[profile?
      db.prepare('UPDATE member_preferences SET revision=revision+1,regular=?,slots_json=?,loadouts_json=?,preferred_role=?,preferred_team=?,updated_at=?,operation_id=? WHERE game_id=? AND player_id=? AND revision=?').bind(+regular,JSON.stringify(slots),JSON.stringify(loadoutIds),preferredRole,preferredTeam,now,operation,GAME,data.playerId,revision):
      db.prepare('INSERT INTO member_preferences (game_id,player_id,token_hash,revision,regular,slots_json,loadouts_json,preferred_role,preferred_team,updated_at,operation_id) VALUES (?,?,?,1,?,?,?,?,?,?,?) ON CONFLICT(game_id,player_id) DO NOTHING').bind(GAME,data.playerId,await hashClaimToken(token),+regular,JSON.stringify(slots),JSON.stringify(loadoutIds),preferredRole,preferredTeam,now,operation)
    ];
    for(const event of open) {
      const attending=selected.includes(event.id);
      statements.push(db.prepare('INSERT INTO attendance_choices (game_id,event_id,player_id,status,preferred_role,note,updated_at,updated_by) SELECT ?,?,?,?,?,?,?,? WHERE '+guard+' ON CONFLICT(game_id,event_id,player_id) DO UPDATE SET status=excluded.status,preferred_role=excluded.preferred_role,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by,revision=attendance_choices.revision+1').bind(GAME,event.id,data.playerId,attending?'attending':'unavailable',preferredRole,note,now,'member',...guardArgs));
      statements.push(db.prepare('DELETE FROM attendance_loadouts WHERE game_id=? AND event_id=? AND player_id=? AND '+guard).bind(GAME,event.id,data.playerId,...guardArgs));
      if(attending)for(const loadout of loadoutIds)statements.push(db.prepare('INSERT INTO attendance_loadouts (game_id,event_id,player_id,loadout_id) SELECT ?,?,?,? WHERE '+guard).bind(GAME,event.id,data.playerId,loadout,...guardArgs));
    }
    statements.push(db.prepare('INSERT INTO audit_log (id,game_id,actor_id,action,entity_id,created_at) SELECT ?,?,?,?,?,? WHERE '+guard).bind(operation,GAME,data.playerId,'week_registration',weekStart,now,...guardArgs));
    const result=await db.batch(statements);
    if(result[0].meta.changes!==1)return json({error:'conflict'},409);
    return json({token,revision:profile?revision+1:1});
  }catch{return json({error:'temporarily_unavailable'},503);}
}
