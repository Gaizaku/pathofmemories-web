import {useEffect, useRef, useState} from "react";
import {autoAssignUnassigned} from "./GuildWarAutoAssign";
type Player = {player_id:string; character_name:string; nickname?:string; preferred_team?:string; preferred_role?:string; loadouts:{id:string;role:string;main_weapon_name:string;sub_weapon_name:string}[]};
type DropTarget = {team:string; playerId?:string};
type Round = {id:string;starts_at:string;war_type:string};
type Placement = {team:string; loadout:string; jungle?:string; tower?:string; position?:number; towerPosition?:number};
const jungles = ["ENEMY_TOP","ENEMY_BOTTOM","ALLY_TOP","ALLY_BOTTOM"];
const lanes = ["TOP","MID","BOTTOM"];
const teams = ["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const teamNames: Record<string,string> = {
  ATTACK_1: "ทีมบุก 1", ATTACK_2: "ทีมบุก 2", ATTACK_3: "ทีมบุก 3",
  DEFENSE_1: "ทีมกัน 1", DEFENSE_2: "ทีมกัน 2", FOREST: "ป่า", STANDBY: "สำรอง",
  UNASSIGNED: "ยังไม่จัดทีม"
};
const title = (s:string, thai=false) => thai ? (teamNames[s] || s) : s.replaceAll("_"," ");
const teamClass = (s:string) => "gw-team-"+s.toLowerCase();
const base = "/api/v2/games/where-winds-meet";
function normalizeBoard(roster:Player[], source:Record<string,Placement>|undefined) {
  const next:Record<string,Placement>={},teamCounts:Record<string,number>={},towerCounts:Record<string,number>={};
  for(const player of roster) {
    const placement=source?.[player.player_id];
    if(!placement||!teams.includes(placement.team))continue;
    if(placement.team!=="STANDBY"&&(teamCounts[placement.team]||0)>=5)continue;
    const valid:Placement={team:placement.team,loadout:player.loadouts.some(loadout=>loadout.id===placement.loadout)?placement.loadout:player.loadouts[0]?.id||""};
    if(Number.isSafeInteger(placement.position)&&placement.position!==undefined&&placement.position>=0)valid.position=placement.position;
    if(placement.team!=="STANDBY"&&placement.jungle&&jungles.includes(placement.jungle))valid.jungle=placement.jungle;
    if(placement.team!=="STANDBY"&&placement.tower&&lanes.includes(placement.tower)&&(towerCounts[placement.tower]||0)<3){valid.tower=placement.tower;valid.towerPosition=Number.isSafeInteger(placement.towerPosition)?placement.towerPosition:towerCounts[placement.tower]||0;towerCounts[placement.tower]=(towerCounts[placement.tower]||0)+1;}
    next[player.player_id]=valid;
    if(placement.team!=="STANDBY")teamCounts[placement.team]=(teamCounts[placement.team]||0)+1;
  }
  return next;
}
export function GuildWarTeamBuilder({language}:{language:"th"|"en"}) {
  const th = language === "th";
  const summaryDialog = useRef<HTMLDialogElement>(null);

  const [rounds,setRounds] = useState<Round[]>([]);
  const [round,setRound] = useState("");
  const [players,setPlayers] = useState<Player[]>([]);
  const [board,setBoard] = useState<Record<string,Placement>>({});
  const [organizer,setOrganizer] = useState<string>("");
  const [search,setSearch] = useState("");
  const [draggingPlayer,setDraggingPlayer] = useState("");
  const [dropTarget,setDropTarget] = useState<DropTarget|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [loadedRound,setLoadedRound] = useState("");
  const [saved,setSaved] = useState(false);
  const [cloudBusy,setCloudBusy] = useState(false);
  const [cloudMessage,setCloudMessage] = useState("");
  const [savedBoard,setSavedBoard] = useState("");
  const [publishedLink,setPublishedLink] = useState("");
  const [publishing,setPublishing] = useState(false);
  const [copyRounds,setCopyRounds] = useState<string[]>([]);
  const [copyPanel,setCopyPanel] = useState(false);
  const [copying,setCopying] = useState(false);
  const [revision,setRevision] = useState(0);
  const activeRound = useRef(round);
  const roundCache = useRef<Record<string,{players:Player[];board:Record<string,Placement>;organizer:string;revision:number;savedBoard:string}>>({});
  activeRound.current = round;
  useEffect(()=>{setRevision(0);setSavedBoard("");setPublishedLink("");setCloudMessage("");},[round]);
  async function cloudDraft() {
    if(!organizer||cloudBusy||loading||loadedRound!==round)return;
    const requestedRound=round;
    setCloudBusy(true);setCloudMessage("");setError("");
    try {
      const response=await fetch(base+"/war/events/"+requestedRound+"/draft",{
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision,board})
      });
      const data=await response.json();
      if(activeRound.current!==requestedRound)return;
      if(!response.ok){
        if(data.error==="draft_conflict")throw new Error(th?"มีฉบับร่างออนไลน์ใหม่กว่า เปลี่ยนรอบแล้วกลับมาอีกครั้งเพื่อโหลดล่าสุด":"A newer online draft exists. Switch rounds and return to load the latest draft.");
        if(data.error==="roster_changed")throw new Error(th?"รายชื่อหรือ Loadout เปลี่ยนแล้ว กรุณา Refresh และตรวจทีม":"Roster or loadouts changed. Refresh and review your team.");
        if(response.status===401)throw new Error(th?"กรุณาเข้าสู่ระบบ Discord อีกครั้ง":"Please sign in with Discord again.");
        throw new Error(th?"ติดต่อฉบับร่างออนไลน์ไม่สำเร็จ ลองใหม่ได้โดยทีมในเครื่องยังอยู่":"Online draft request failed. Your local board is retained.");
      }
      setSavedBoard(JSON.stringify(board));
      setRevision(data.revision);
      setCloudMessage(th?"บันทึกออนไลน์แล้ว · ยังไม่ประกาศ":"Saved online · Not published");
    }catch(err){if(activeRound.current===requestedRound)setError(err instanceof Error?err.message:"Request failed");}
    finally{setCloudBusy(false);}
  }

  async function publishTeam() {
    if(publishing||cloudBusy||revision<1||savedBoard!==JSON.stringify(board))return;
    if(!window.confirm(th?"ประกาศทีมฉบับนี้? ผู้มีลิงก์จะดูรายชื่อ อาวุธ และตำแหน่งได้ โดยไม่ต้องล็อกอิน":"Publish this edition? Anyone with the link can view names, weapons and assignments without signing in."))return;
    const requestedRound=round;
    setPublishing(true);setError("");
    try{
      const response=await fetch(base+"/war/events/"+round+"/publications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision})});
      const result=await response.json();
      if(!response.ok)throw new Error(response.status===409
        ?(th?"ทีมเปลี่ยนหรือมีทีมเกิน 5 คน กรุณา Refresh ตรวจทีมและบันทึกออนไลน์อีกครั้ง":"Review your roster, squad capacity and online draft before publishing.")
        :(th?"ยังประกาศไม่สำเร็จ กรุณาตรวจว่าระบบประกาศพร้อมใช้งาน แล้วลองใหม่":"Publishing is unavailable. Check setup and retry."));
      if(activeRound.current===requestedRound){
        setPublishedLink(window.location.origin+"/games/where-winds-meet/guild-war/published/"+requestedRound+"/"+result.id);
        setCloudMessage(result.webhook==="sent"?(th?"ประกาศทีมและส่ง Discord แล้ว":"Published and sent to Discord") : result.webhook==="unconfigured"?(th?"ประกาศทีมแล้ว · ยังไม่ตั้งค่า Discord Webhook":"Published · Discord Webhook is not configured") : result.webhook==="failed"?(th?"ประกาศทีมแล้ว · ส่ง Discord ไม่สำเร็จ":"Published · Discord delivery failed") : (th?"ประกาศทีมแล้ว":"Published"));
      }
    }catch(e){setError(e instanceof Error?e.message:"Publish failed");}
    finally{setPublishing(false);}
  }

  async function copyBoardToRounds() {
    const destinations=copyRounds.filter(destination=>destination!==round);
    if(!organizer||copying||cloudBusy||publishing||loading||loadedRound!==round||!destinations.length)return;
    if(!Object.keys(board).length){setError(th?"ยังไม่มีทีมให้คัดลอก":"There is no team to copy");return;}
    if(!window.confirm(th?`คัดลอกทีมนี้ไปแทนฉบับร่างของ ${destinations.length} รอบที่เลือก? รายชื่อที่ไม่ได้ลงรอบนั้นจะถูกข้าม`:`Replace the online drafts for ${destinations.length} selected rounds? Players not registered for a round will be skipped.`))return;
    setCopying(true);setCloudMessage("");setError("");
    const outcomes=await Promise.all(destinations.map(async destination=>{
      try {
      const [rosterResponse,draftResponse]=await Promise.all([
        fetch(base+"/war/events/"+destination+"/registrations"),
        fetch(base+"/war/events/"+destination+"/draft")
      ]);
      const rosterData=await rosterResponse.json(),draftData=await draftResponse.json();
      if(!rosterResponse.ok||!draftResponse.ok)throw new Error(th?"โหลดข้อมูลรอบปลายทางไม่สำเร็จ":"Could not load the destination round");
      const roster:Player[]=rosterData.registrations||[];
      const rosterById=new Map(roster.map(player=>[player.player_id,player]));
      const next:Record<string,Placement>={},teamCounts:Record<string,number>={},towerCounts:Record<string,number>={};
      for(const [playerId,placement] of Object.entries(board).sort(([,a],[,b])=>(a.position??0)-(b.position??0))) {
        const player=rosterById.get(playerId);
        if(!player||!teams.includes(placement.team))continue;
        if(placement.team!=="STANDBY"&&(teamCounts[placement.team]||0)>=5)continue;
        const loadout=player.loadouts.some(item=>item.id===placement.loadout)?placement.loadout:player.loadouts[0]?.id||"";
        const copied:Placement={team:placement.team,loadout,position:placement.position};
        if(placement.team!=="STANDBY"&&placement.jungle&&jungles.includes(placement.jungle))copied.jungle=placement.jungle;
        if(placement.team!=="STANDBY"&&placement.tower&&lanes.includes(placement.tower)&&(towerCounts[placement.tower]||0)<3){copied.tower=placement.tower;copied.towerPosition=placement.towerPosition??(towerCounts[placement.tower]||0);towerCounts[placement.tower]=(towerCounts[placement.tower]||0)+1;}
        next[playerId]=copied;
        if(placement.team!=="STANDBY")teamCounts[placement.team]=(teamCounts[placement.team]||0)+1;
      }
      const response=await fetch(base+"/war/events/"+destination+"/draft",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:draftData.revision||0,board:next})});
      const result=await response.json();
      if(!response.ok){
        if(result.error==="draft_conflict")throw new Error(th?"ฉบับร่างเปลี่ยนแล้ว":"The draft changed");
        if(result.error==="roster_changed")throw new Error(th?"รายชื่อเปลี่ยนแล้ว":"The roster changed");
        throw new Error(th?"คัดลอกไม่สำเร็จ":"Copy failed");
      }
      return {destination,count:Object.keys(next).length};
      } catch(error) {return {destination,error:error instanceof Error?error.message:"Copy failed"};}
    }));
    const done=outcomes.filter((outcome):outcome is {destination:string;count:number}=>"count" in outcome);
    const failed=outcomes.filter((outcome):outcome is {destination:string;error:string}=>"error" in outcome);
    if(done.length){setCloudMessage(th?`คัดลอกทีมไป ${done.length} รอบแล้ว · เปลี่ยนรอบปลายทางเพื่อตรวจ`:`Copied the team to ${done.length} rounds · Switch to a destination to review`);setCopyRounds([]);setCopyPanel(false);}
    if(failed.length)setError(th?`คัดลอกไม่สำเร็จ ${failed.length} รอบ: ${failed.map(outcome=>rounds.find(item=>item.id===outcome.destination)?.war_type||outcome.destination).join(", ")}`:`Could not copy ${failed.length} rounds: ${failed.map(outcome=>outcome.error).join(", ")}`);
    setCopying(false);
  }

  async function get(url:string,signal:AbortSignal) {
    const response = await fetch(url,{signal});
    if (!response.ok) throw new Error("request_failed");
    return response.json();
  }
  useEffect(()=>{
    const c = new AbortController();
    get(base+"/war/events",c.signal).then(d=>{
      setRounds(d.events||[]); setRound(r=>r||d.events?.[0]?.id||"");setLoading(false);
    }).catch(()=>{if(!c.signal.aborted){setError(th?"โหลดรอบ War ไม่สำเร็จ":"Could not load rounds");setLoading(false);}});
    return ()=>c.abort();
  },[]);
  useEffect(()=>{
    if(!round)return;
    const c=new AbortController();
    const cached=roundCache.current[round];
    setLoading(!cached);setError("");setLoadedRound(cached?round:"");setDraggingPlayer("");setDropTarget(null);
    if(cached){
      setPlayers(cached.players);setBoard(cached.board);setOrganizer(cached.organizer);setRevision(cached.revision);setSavedBoard(cached.savedBoard);setSaved(true);
    }
    void (async()=>{
      try {
        const response=await get(base+"/war/events/"+round+"/team-builder",c.signal);
        const roster:Player[]=response.registrations||[];
        let source:Record<string,Placement>|undefined;
        try{source=JSON.parse(localStorage.getItem("pom-board-v2:"+round)||"{}");}catch{source={};}
        const onlineRevision=response.revision||0,loadedOnline=onlineRevision>0;
        if(loadedOnline)source=response.board;
        if(c.signal.aborted)return;
        const valid=normalizeBoard(roster,source);
        const next={players:roster,board:valid,organizer:response.organizer?.displayName||"",revision:onlineRevision,savedBoard:loadedOnline?JSON.stringify(valid):""};
        roundCache.current[round]=next;
        setPlayers(next.players);setBoard(next.board);setOrganizer(next.organizer);setRevision(next.revision);setSavedBoard(next.savedBoard);setLoadedRound(round);setLoading(false);setSaved(true);
        if(loadedOnline)setCloudMessage(th?"โหลดฉบับร่างออนไลน์อัตโนมัติแล้ว":"Online draft loaded automatically");
      }catch{if(!c.signal.aborted){setLoading(false);setError(th?"โหลดรายชื่อไม่สำเร็จ กด Refresh เพื่อลองใหม่":"Could not load roster. Refresh to retry.");}}
    })();
    return ()=>c.abort();
  },[round]);
  useEffect(()=>{
    if(!organizer||loadedRound!==round||!round)return;
    const cached=roundCache.current[round];
    if(cached)roundCache.current[round]={...cached,board,organizer,revision,savedBoard};
    try{localStorage.setItem("pom-board-v2:"+round,JSON.stringify(board));setSaved(true);}
    catch{setSaved(false);setError(th?"บันทึกฉบับร่างในเครื่องไม่ได้":"Could not save local draft");}
  },[board,loadedRound,round,organizer,revision,savedBoard]);
  function limitedTeam(team:string){return !!team&&team!=="STANDBY";}
  function teamMemberCount(team:string){return players.filter(p=>board[p.player_id]?.team===team).length;}
  function destinationIsFull(team:string,id:string,target?:string){
    return limitedTeam(team)&&!target&&board[id]?.team!==team&&teamMemberCount(team)>=5;
  }
  function ordered(team:string,current:Record<string,Placement>=board){
    return players.filter(p=>current[p.player_id]?.team===team).sort((a,b)=>{
      const aPosition=current[a.player_id].position??Number.MAX_SAFE_INTEGER;
      const bPosition=current[b.player_id].position??Number.MAX_SAFE_INTEGER;
      return aPosition-bPosition||a.character_name.localeCompare(b.character_name);
    });
  }
  function positionOf(id:string,team:string,current:Record<string,Placement>){
    const saved=current[id]?.position;
    return Number.isSafeInteger(saved)&&saved!==undefined&&saved>=0?saved:ordered(team,current).findIndex(player=>player.player_id===id);
  }
  function nextPosition(team:string,current:Record<string,Placement>){
    return ordered(team,current).reduce((highest,player)=>Math.max(highest,positionOf(player.player_id,team,current)),-1)+1;
  }
  function move(id:string,team:string,target?:string){
    if(!organizer||cloudBusy||publishing||loading||!players.some(p=>p.player_id===id)||id===target)return;
    if(destinationIsFull(team,id,target)){
      setError(th?"ทีมนี้เต็มแล้ว (สูงสุด 5 คน) · วางทับผู้เล่นเพื่อสลับทีมได้":"This team is full (maximum 5). Drop on a player to swap teams.");
      return;
    }
    setBoard(previous=>{
      const next={...previous};const source=next[id];
      const targetPlacement=target?next[target]:undefined;
      if(target&&targetPlacement){
        const targetPosition=positionOf(target,targetPlacement.team,next);
        if(source)next[target]={...targetPlacement,team:source.team,position:positionOf(id,source.team,next)};else delete next[target];
        if(team)next[id]={...source,team,position:targetPosition,loadout:source?.loadout||players.find(p=>p.player_id===id)?.loadouts[0]?.id||""};
        else delete next[id];
      } else if(team) {
        const keepPosition=source?.team===team?positionOf(id,team,next):nextPosition(team,next);
        next[id]={...source,team,position:keepPosition,loadout:source?.loadout||players.find(p=>p.player_id===id)?.loadouts[0]?.id||""};
      } else {
        delete next[id];
      }
      for(const playerId of Object.keys(next))if(next[playerId].team==="STANDBY"){
        next[playerId]={...next[playerId],jungle:undefined,tower:undefined,towerPosition:undefined};
      }
      return next;
    });
    setError("");setDraggingPlayer("");setDropTarget(null);
  }
  function autoAssign(){
    if(!organizer||cloudBusy||publishing||loading||loadedRound!==round)return;
    const result=autoAssignUnassigned(players,board);
    if(result.assigned===0&&result.standby===0){setCloudMessage(th?"ไม่มีผู้เล่นที่ยังไม่จัดทีม":"Everyone is already assigned");return;}
    setBoard(result.board);
    setError("");
    setCloudMessage(th?`จัดผู้เล่นเพิ่ม ${result.assigned} คน${result.standby?` · สำรอง ${result.standby} คน`:""} · ตรวจทีมก่อนบันทึก`:`Assigned ${result.assigned} players${result.standby?` · ${result.standby} standby`:""} · Review before saving`);
  }
  function drop(e:React.DragEvent,team:string,target?:string){
    e.preventDefault();e.stopPropagation();
    move(e.dataTransfer.getData("application/x-pom-player")||e.dataTransfer.getData("text/plain")||draggingPlayer,team,target);
  }

  function towerMembers(lane:string,current:Record<string,Placement>=board){
    return players.filter(player=>current[player.player_id]?.tower===lane).sort((a,b)=>{
      const aPosition=current[a.player_id].towerPosition??Number.MAX_SAFE_INTEGER;
      const bPosition=current[b.player_id].towerPosition??Number.MAX_SAFE_INTEGER;
      return aPosition-bPosition||positionOf(a.player_id,current[a.player_id].team,current)-positionOf(b.player_id,current[b.player_id].team,current);
    });
  }
  function setTower(id:string,lane:string,center=false) {
    if(!organizer||cloudBusy||publishing||loading||!board[id]||board[id].team==="STANDBY")return;
    if(lane&&Object.entries(board).filter(([pid,p])=>pid!==id&&p.tower===lane).length>=3){
      setError(th?"Tower ตำแหน่งนี้ครบ 3 คนแล้ว":"This tower already has 3 players");return;
    }
    setBoard(current=>{
      const next={...current};
      if(!lane){next[id]={...next[id],tower:undefined,towerPosition:undefined};return next;}
      const others=towerMembers(lane,current).filter(player=>player.player_id!==id);
      if(center){
        next[id]={...next[id],tower:lane,towerPosition:0};
        others.forEach((player,index)=>{next[player.player_id]={...next[player.player_id],towerPosition:index+1};});
      }else next[id]={...next[id],tower:lane,towerPosition:current[id].tower===lane?current[id].towerPosition??0:others.length};
      return next;
    });setError("");
  }
  function role(p:Player){return p.loadouts.find(l=>l.id===board[p.player_id]?.loadout)?.role||p.preferred_role||p.loadouts[0]?.role||"—";}
  function card(p:Player){
    const place=board[p.player_id];
    const isSwapTarget=dropTarget?.playerId===p.player_id;
    return <article key={p.player_id} className={"gw-player gw-role-"+role(p)+(draggingPlayer===p.player_id?" gw-dragging":"")+(isSwapTarget?" gw-swap-target":"")}
      draggable={!!organizer&&!loading&&!cloudBusy&&!publishing}
      onDragStart={e=>{e.dataTransfer.setData("application/x-pom-player",p.player_id);e.dataTransfer.setData("text/plain",p.player_id);e.dataTransfer.effectAllowed="move";setDraggingPlayer(p.player_id);setDropTarget(null);}}
      onDragEnd={()=>{setDraggingPlayer("");setDropTarget(null);}}
      onDragEnter={e=>{e.preventDefault();e.stopPropagation();if(draggingPlayer&&draggingPlayer!==p.player_id)setDropTarget({team:place?.team||"",playerId:p.player_id});}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect="move";if(draggingPlayer&&draggingPlayer!==p.player_id)setDropTarget({team:place?.team||"",playerId:p.player_id});}}
      onDrop={e=>drop(e,place?.team||"",p.player_id)}>
      <div className="gw-pick" title={th?"ลากการ์ดนี้ไปทับผู้เล่นอีกคนเพื่อสลับ":"Drag this card onto another player to swap"}>
        <span>{p.character_name}{p.nickname&&<small> ({p.nickname})</small>}</span>
      </div>
      {place&&<button className="gw-remove" disabled={!organizer} onClick={()=>move(p.player_id,"")} aria-label={th?"นำออกจากทีม":"Remove from team"}>×</button>}
      <div className="gw-meta">{th?"อยากเล่น: ":"Preferred: "}{p.preferred_role||"—"}</div>
      {!place&&p.preferred_team&&<div className={"gw-preferred-team "+teamClass(p.preferred_team)}>{th?"อยากอยู่: ":"Wants: "}{title(p.preferred_team,th)}</div>}
      {place?<select aria-label={"Loadout "+p.character_name} value={place.loadout} disabled={!organizer} onChange={e=>setBoard(current=>({...current,[p.player_id]:{...current[p.player_id],loadout:e.target.value}}))}>
        {!p.loadouts.length&&<option value="">—</option>}{p.loadouts.map(l=><option key={l.id} value={l.id}>{l.role} · {l.main_weapon_name} + {l.sub_weapon_name}</option>)}
      </select>:<div className="gw-meta">{p.loadouts.map(l=>l.main_weapon_name+" + "+l.sub_weapon_name).join(" / ")}</div>}
      {place&&place.team!=="STANDBY"&&<select className={"gw-jungle-select "+(place.jungle?"gw-jungle-"+place.jungle.toLowerCase():"")} aria-label={"Jungle "+p.character_name} value={place.jungle||""} disabled={!organizer||loading}
        onChange={e=>setBoard(current=>({...current,[p.player_id]:{...current[p.player_id],jungle:e.target.value||undefined}}))}>
        <option value="">{th?"ไม่เข้าป่า":"No jungle"}</option>
        {jungles.map((j,i)=><option key={j} value={j}>{th?["ศัตรูบน","ศัตรูล่าง","เราบน","เราล่าง"][i]:title(j,th)}</option>)}
      </select>}
    </article>;
  }
  function squad(team:string){
    const members=ordered(team);
    const tank=members.filter(p=>role(p)==="Tank").length,heal=members.filter(p=>role(p)==="Heal").length;
    const teamFull=limitedTeam(team)&&members.length>=5;
    const isTeamDropTarget=dropTarget?.team===team&&!dropTarget.playerId;
    const isSourceTeam=draggingPlayer&&board[draggingPlayer]?.team===team;
    return <section key={team} className={"gw-squad "+teamClass(team)+(team.startsWith("ATTACK")?" gw-attack":team==="FOREST"?" gw-forest":" gw-defense")+(isSourceTeam?" gw-drag-source":"")+(isTeamDropTarget?(teamFull?" gw-drop-blocked":" gw-drop-ready"):"")}
      onDragOver={e=>{e.preventDefault();if(draggingPlayer)setDropTarget({team});}} onDrop={e=>drop(e,team)}>
      <header><strong>{title(team,th)}</strong><span>{members.length}{team!=="STANDBY"?"/5":""}</span></header>
      {team!=="STANDBY"&&<div className="gw-meta">Tank {tank} · Heal {heal}{teamFull?" · "+(th?"เต็ม":"Full"):""}</div>}
      <div className="gw-slots">{members.map(card)}</div>
      <div className="gw-drop">{teamFull?(th?"ทีมเต็ม · ลากทับผู้เล่นเพื่อสลับ":"Team full · Drag onto a player to swap"):(th?"ลากผู้เล่นมาวาง":"Drag players here")}</div>
    </section>;
  }
  const pool=players.filter(p=>!board[p.player_id]);
  const warnings=teams.filter(t=>t!=="STANDBY").filter(t=>{
    const m=players.filter(p=>board[p.player_id]?.team===t);
    return m.length>0&&(m.length>5||!m.some(p=>role(p)==="Tank")||!m.some(p=>role(p)==="Heal"));
  }).length;

  const roundInfo=rounds.find(r=>r.id===round);
  function roundHeading(info?:Round){
    if(!info)return round;
    const date=new Date(info.starts_at),parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date),hour=parts.find(part=>part.type==="hour")?.value||"",minute=parts.find(part=>part.type==="minute")?.value||"";
    const day=new Intl.DateTimeFormat(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",year:"numeric"}).format(date);
    const number=rounds.findIndex(item=>item.id===info.id)+1;
    return th?`รอบ ${number} (${info.war_type}) · ${hour}.${minute} · ${day}`:`Round ${number} (${info.war_type}) · ${hour}:${minute} · ${day}`;
  }
  function jungleLabel(jungle?:string){
    const labels=th?["ศัตรูบน","ศัตรูล่าง","เราบน","เราล่าง"]:["Enemy top","Enemy bottom","Ally top","Ally bottom"];
    return jungle?labels[jungles.indexOf(jungle)]||jungle:"";
  }
  function summaryPlayer(p:Player,index:number){
    const placement=board[p.player_id];
    const loadout=p.loadouts.find(l=>l.id===placement?.loadout);
    return <div className="gw-summary-player" key={p.player_id}>
      <span className="gw-summary-number">{index+1}</span>
      <span className="gw-summary-name"><b>{p.character_name}</b>{p.nickname&&<small>{p.nickname}</small>}</span>
      <strong className={"gw-summary-role gw-role-"+role(p)}>{role(p)}</strong>
      <span className="gw-summary-weapons">{loadout?loadout.main_weapon_name+" + "+loadout.sub_weapon_name:"—"}</span>
      {placement?.jungle&&<span className={"gw-summary-jungle gw-jungle-"+placement.jungle.toLowerCase()}>{jungleLabel(placement.jungle)}</span>}
    </div>;
  }
  return <section className="gw-builder"><fieldset disabled={cloudBusy||publishing} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <header className="gw-top"><div><h1>Guild War Team Builder</h1><p>{th?"ลากผู้เล่นไปทับอีกคนเพื่อสลับ · ทีมละ 5 คน":"Drag a player onto another to swap · 5 per team"}</p></div>
      <div className="gw-toolbar"><select aria-label="War round" value={round} onChange={e=>setRound(e.target.value)}>{rounds.map(r=><option key={r.id} value={r.id}>{new Date(r.starts_at).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"})} · {r.war_type}</option>)}</select>
      <button disabled={!organizer||loading||loadedRound!==round} onClick={autoAssign}>{th?"จัดอัตโนมัติ":"Auto assign"}</button>
      <button disabled={!organizer||loading||loadedRound!==round||copying} onClick={()=>setCopyPanel(value=>!value)}>{th?`คัดลอกไปรอบอื่น${copyRounds.length?` (${copyRounds.length})`:""}`:`Copy to other rounds${copyRounds.length?` (${copyRounds.length})`:""}`}</button>
      <button disabled={!organizer||loading||loadedRound!==round} onClick={()=>summaryDialog.current?.showModal()}>Team Summary</button>
      <span className="gw-primary-actions"><button className="gw-save" disabled={!organizer||loading||loadedRound!==round} onClick={()=>void cloudDraft()}>{th?"บันทึก":"Save"}</button><button className="gw-clear-board" disabled={!organizer||loading} onClick={()=>{if(window.confirm(th?"ล้างทีมรอบนี้?":"Clear this team's board?"))setBoard({});}}>{th?"ล้างทีม":"Clear team"}</button></span></div></header>
    {copyPanel&&<section className="gw-copy-panel"><header><div><strong>{th?"คัดลอกการจัดทีมไปยังรอบอื่น":"Copy team arrangement to other rounds"}</strong><p>{th?"เลือกรอบปลายทางได้หลายรอบพร้อมกัน รายชื่อที่ไม่ได้ลงในรอบนั้นจะถูกข้าม":"Choose multiple destination rounds. Players unavailable in a round will be skipped."}</p></div><button type="button" onClick={()=>setCopyPanel(false)}>{th?"ปิด":"Close"}</button></header><div className="gw-copy-rounds">{rounds.filter(item=>item.id!==round).map(item=>{const checked=copyRounds.includes(item.id);return <label key={item.id}><input type="checkbox" checked={checked} disabled={copying} onChange={()=>setCopyRounds(current=>checked?current.filter(id=>id!==item.id):[...current,item.id])}/><span>{new Date(item.starts_at).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"})} · {item.war_type}</span></label>})}</div><footer><button type="button" onClick={()=>setCopyRounds([])} disabled={!copyRounds.length||copying}>{th?"ล้างที่เลือก":"Clear selection"}</button><button type="button" className="gw-copy-confirm" disabled={!copyRounds.length||copying} onClick={()=>void copyBoardToRounds()}>{copying?(th?"กำลังคัดลอก…":"Copying…"):(th?`คัดลอกไป ${copyRounds.length} รอบ`:`Copy to ${copyRounds.length} rounds`)}</button></footer></section>}
    <div className="gw-status">{organizer?organizer:<a href="/api/auth/discord/login?return=%2Fgames%2Fwhere-winds-meet%2Fguild-war%2Fteams">Discord Login</a>} · {saved?(th?"ฉบับร่างบันทึกในเครื่อง · ยังไม่ประกาศ":"Local draft saved · Not published"):(th?"ฉบับร่างในเครื่อง":"Local draft")}</div>
    <p role="status" aria-live="polite">{cloudBusy?(th?"กำลังติดต่อฉบับร่างออนไลน์…":"Updating online draft…"):cloudMessage}</p>
    {error&&<p role="alert" className="gw-error">{error}</p>}
    <div className="gw-stats">{[[players.length,"Registered"],[players.length-pool.length,"Assigned"],[pool.length,"Unassigned"],[warnings,"Squad warnings"]].map(([n,l])=><div key={l}><b>{n}</b><small>{l}</small></div>)}</div>
    {loading?<p role="status">{th?"กำลังโหลด…":"Loading…"}</p>:<div className="gw-layout"><aside className={"gw-pool "+(dropTarget?.team===""&&!dropTarget.playerId?" gw-drop-ready":"")} onDragOver={e=>{e.preventDefault();if(draggingPlayer)setDropTarget({team:""});}} onDrop={e=>drop(e,"")}>
      <header><strong>{th?"ยังไม่จัดทีม":"Unassigned"}</strong><input aria-label="Search players" placeholder={th?"ค้นหาชื่อ…":"Search players…"} value={search} onChange={e=>setSearch(e.target.value)}/></header>
      <div className="gw-pool-list">{pool.filter(p=>(p.character_name+" "+(p.nickname||"")).toLowerCase().includes(search.toLowerCase())).map(card)}</div>
    </aside><div className="gw-board"><div className="gw-sides"><section><h2>{th?"ฝั่งบุก":"Attack"}</h2><div className="gw-squads">{teams.slice(0,3).map(squad)}</div></section><section><h2>{th?"ฝั่งกัน":"Defense"}</h2><div className="gw-squads">{teams.slice(3,6).map(squad)}</div></section></div><div className="gw-standby">{squad("STANDBY")}</div></div><section className="gw-tactical"><h2>Tower Assignment</h2><p>{th?"ลากผู้เล่นจากทีมมาวาง · ลากทับรายชื่อหรือกดปุ่มเพื่อเลือกกลางป้อม":"Drag players from a team here · Drop on a name or use the button to set the tower center"}</p>
      <div className="gw-towers">{lanes.map(lane=><section key={lane} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();setTower(e.dataTransfer.getData("application/x-pom-player")||e.dataTransfer.getData("text/plain")||draggingPlayer,lane);}}>
        <header><strong>{title(lane,th)}</strong><span>{Object.values(board).filter(p=>p.tower===lane).length}/3</span></header>
        {towerMembers(lane).map((player,index)=><div className="gw-tower-player" key={player.player_id} onDragOver={e=>{e.preventDefault();e.stopPropagation();}} onDrop={e=>{e.preventDefault();e.stopPropagation();setTower(e.dataTransfer.getData("application/x-pom-player")||e.dataTransfer.getData("text/plain")||draggingPlayer,lane,true);}}><span>{player.character_name}</span>{index===0?<b className="gw-tower-center">{th?"กลางป้อม":"Center"}</b>:<button className="gw-center-button" disabled={!organizer} onClick={()=>setTower(player.player_id,lane,true)}>{th?"ตั้งกลาง":"Set center"}</button>}<button disabled={!organizer} onClick={()=>setTower(player.player_id,"")} aria-label={"Remove tower "+player.character_name}>×</button></div>)}
      </section>)}</div>
    </section></div>}
  </fieldset>
    <dialog ref={summaryDialog} className="gw-summary-dialog">
      <header><div><h2 className="gw-summary-round-heading">{roundHeading(roundInfo)}</h2></div><div className="gw-summary-actions"><button className="gw-publish" disabled={publishing||cloudBusy||loading||!organizer||revision<1||savedBoard!==JSON.stringify(board)||Object.keys(board).length===0||warnings>0&&teams.some(t=>t!=="STANDBY"&&Object.values(board).filter(p=>p.team===t).length>5)} onClick={publishTeam}>{publishing?(th?"กำลังประกาศ…":"Publishing…"):(th?"ประกาศทีม":"Publish teams")}</button><button onClick={()=>summaryDialog.current?.close()} autoFocus>{th?"กลับไปจัดทีม":"Back to builder"}</button></div></header>
      <p className="gw-status">{th?"ฉบับร่าง · ยังไม่ประกาศ":"Draft · Not published"}</p>
      {warnings>0&&<p className="gw-error">{warnings} {th?"ทีมต้องตรวจสอบ":"team warnings"}</p>}
      <div className="gw-summary-grid">{teams.filter(team=>team!=="STANDBY").map(team=>{const members=ordered(team);return (<section key={team} className={"gw-summary-team "+teamClass(team)}>
        <header><h3>{title(team,th)}</h3><span>{members.length}{team!=="STANDBY"&&team!=="UNASSIGNED"?"/5":""}</span></header>
        <div className="gw-summary-members">{members.map(summaryPlayer)}</div>
      </section>);})}</div>
      <section className="gw-summary-towers"><header><h3>TOWER</h3><p>{th?"คนแรกของแต่ละป้อมคือ กลางป้อม":"The first player in each tower is the tower center"}</p></header><div>{lanes.map(lane=>{const members=towerMembers(lane);return <section key={lane}><h4>{th?"ป้อม"+({TOP:"บน",MID:"กลาง",BOTTOM:"ล่าง"}[lane]||lane):"Tower "+lane}</h4>{members.length?members.map((player,index)=><p key={player.player_id}><b>{player.character_name}</b>{index===0&&<span className="gw-tower-center">{th?"กลางป้อม":"Tower center"}</span>}</p>):<p className="gw-summary-empty">—</p>}</section>;})}</div></section>
      <section className="gw-summary-standby gw-team-standby"><header><h3>{th?"สำรอง":"Standby"}</h3><span>{ordered("STANDBY").length}</span></header><div>{ordered("STANDBY").map(player=><p key={player.player_id}>{player.character_name}</p>)}</div></section>
      {savedBoard!==JSON.stringify(board)&&<p className="gw-summary-notice">{th?"บันทึกออนไลน์ก่อนจึงจะประกาศทีมได้":"Save online before publishing this team."}</p>}
      {publishedLink&&<p className="gw-summary-notice" role="status">{th?"ประกาศแล้ว: ":"Published: "}<a href={publishedLink} target="_blank" rel="noreferrer">{th?"เปิดทีมที่ประกาศ":"Open published teams"}</a></p>}
    </dialog>
  </section>;
}
