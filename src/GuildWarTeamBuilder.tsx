import {useEffect, useRef, useState} from "react";
type Player = {player_id:string; character_name:string; nickname?:string; attendance_status?:string; preferred_team?:string; preferred_role?:string; loadouts:{id:string;role:string;main_weapon_name:string;sub_weapon_name:string}[]};
type DropTarget = {team:string; playerId?:string};
type Round = {id:string;starts_at:string;war_type:string};
type Placement = {team:string; loadout:string; jungle?:string; tower?:string};
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
export function GuildWarTeamBuilder({language}:{language:"th"|"en"}) {
  const th = language === "th";
  const summaryDialog = useRef<HTMLDialogElement>(null);
  const [copyMessage,setCopyMessage] = useState("");

  const [rounds,setRounds] = useState<Round[]>([]);
  const [round,setRound] = useState("");
  const [players,setPlayers] = useState<Player[]>([]);
  const [board,setBoard] = useState<Record<string,Placement>>({});
  const [organizer,setOrganizer] = useState<string>("");
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState("");
  const [draggingPlayer,setDraggingPlayer] = useState("");
  const [dropTarget,setDropTarget] = useState<DropTarget|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [loadedRound,setLoadedRound] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [saved,setSaved] = useState(false);
  const [cloudBusy,setCloudBusy] = useState(false);
  const [cloudMessage,setCloudMessage] = useState("");
  const [savedBoard,setSavedBoard] = useState("");
  const [publishedLink,setPublishedLink] = useState("");
  const [publishing,setPublishing] = useState(false);
  const [revision,setRevision] = useState(0);
  const activeRound = useRef(round);
  activeRound.current = round;
  useEffect(()=>{setRevision(0);setSavedBoard("");setPublishedLink("");setCloudMessage("");},[round,refresh]);
  async function cloudDraft(action:"load"|"save") {
    if(!organizer||cloudBusy||loading||cloudBusy||loadedRound!==round)return;
    if(action==="load"&&!window.confirm(th?"โหลดฉบับร่างออนไลน์แทนที่ทีมบนหน้าจอนี้?":"Replace this board with the online draft?"))return;
    const requestedRound=round;
    setCloudBusy(true);setCloudMessage("");setError("");
    try {
      const response=await fetch(base+"/war/events/"+requestedRound+"/draft",action==="save"?{
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision,board})
      }:{method:"GET"});
      const data=await response.json();
      if(activeRound.current!==requestedRound)return;
      if(!response.ok){
        if(data.error==="draft_conflict")throw new Error(th?"มีฉบับร่างออนไลน์ใหม่กว่า กดโหลดออนไลน์ก่อนบันทึกอีกครั้ง":"A newer online draft exists. Load it before saving.");
        if(data.error==="roster_changed")throw new Error(th?"รายชื่อหรือ Loadout เปลี่ยนแล้ว กรุณา Refresh และตรวจทีม":"Roster or loadouts changed. Refresh and review your team.");
        if(response.status===401)throw new Error(th?"กรุณาเข้าสู่ระบบ Discord อีกครั้ง":"Please sign in with Discord again.");
        throw new Error(th?"ติดต่อฉบับร่างออนไลน์ไม่สำเร็จ ลองใหม่ได้โดยทีมในเครื่องยังอยู่":"Online draft request failed. Your local board is retained.");
      }
      if(action==="load"){
        if(data.revision===0){setRevision(0);setCloudMessage(th?"ยังไม่มีฉบับร่างออนไลน์ ทีมในเครื่องยังอยู่":"No online draft yet. Local board retained.");return;}
        const next:Record<string,Placement>={};
        const loadedCounts:Record<string,number>={};
        for(const p of players){
          const placement=data.board?.[p.player_id];
          if(!placement||!teams.includes(placement.team)) continue;
          if(placement.team!=="STANDBY"&&(loadedCounts[placement.team]||0)>=5) continue;
          next[p.player_id]={
            ...placement,
            loadout:p.loadouts.some(l=>l.id===placement.loadout)?placement.loadout:p.loadouts[0]?.id||""
          };
          if(placement.team!=="STANDBY")loadedCounts[placement.team]=(loadedCounts[placement.team]||0)+1;
        }
        setBoard(next);
        setSavedBoard(JSON.stringify(next)===JSON.stringify(data.board)?JSON.stringify(next):"");
      }
      if(action==="save")setSavedBoard(JSON.stringify(board));
      setRevision(data.revision);
      setCloudMessage(action==="save"?(th?"บันทึกออนไลน์แล้ว · ยังไม่ประกาศ":"Saved online · Not published"):(th?"โหลดฉบับร่างออนไลน์แล้ว":"Online draft loaded"));
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

  async function get(url:string,signal:AbortSignal) {
    const response = await fetch(url,{signal});
    if (!response.ok) throw new Error("request_failed");
    return response.json();
  }
  useEffect(()=>{
    const c = new AbortController();
    get("/api/auth/discord/session",c.signal).then(d=>setOrganizer(d.organizer?.displayName||"")).catch(()=>{});
    get(base+"/war/events",c.signal).then(d=>{
      setRounds(d.events||[]); setRound(r=>r||d.events?.[0]?.id||"");setLoading(false);
    }).catch(()=>{if(!c.signal.aborted){setError(th?"โหลดรอบ War ไม่สำเร็จ":"Could not load rounds");setLoading(false);}});
    return ()=>c.abort();
  },[refresh]);
  useEffect(()=>{
    if(!round)return;
    const c=new AbortController();setLoading(true);setError("");setLoadedRound("");setSelected("");setDraggingPlayer("");setDropTarget(null);
    get(base+"/war/events/"+round+"/registrations",c.signal).then(d=>{
      const roster:Player[]=d.registrations||[];const valid:Record<string,Placement>={};
      const teamCounts:Record<string,number>={};
      try {
        const old=JSON.parse(localStorage.getItem("pom-board-v2:"+round)||"{}");
        for(const p of roster) {
          const placement=old[p.player_id];
          if(!placement||!teams.includes(placement.team)) continue;
          if(placement.team!=="STANDBY"&&(teamCounts[placement.team]||0)>=5) continue;
          valid[p.player_id]={team:placement.team,loadout:p.loadouts.some(l=>l.id===placement.loadout)?placement.loadout:p.loadouts[0]?.id||""};
          if(placement.team!=="STANDBY")teamCounts[placement.team]=(teamCounts[placement.team]||0)+1;
        }
      }catch{}
      const counts:Record<string,number>={};
      try {
        const old=JSON.parse(localStorage.getItem("pom-board-v2:"+round)||"{}");
        for(const id of Object.keys(valid)) {
          if(valid[id].team==="STANDBY")continue;
          if(jungles.includes(old[id]?.jungle))valid[id].jungle=old[id].jungle;
          const lane=old[id]?.tower;
          if(lanes.includes(lane)&&(counts[lane]||0)<3){valid[id].tower=lane;counts[lane]=(counts[lane]||0)+1;}
        }
      }catch{}
      setPlayers(roster);setBoard(valid);setLoadedRound(round);setLoading(false);setSaved(true);
    }).catch(()=>{if(!c.signal.aborted){setLoading(false);setError(th?"โหลดรายชื่อไม่สำเร็จ กด Refresh เพื่อลองใหม่":"Could not load roster. Refresh to retry.");}});
    return ()=>c.abort();
  },[round,refresh]);
  useEffect(()=>{
    if(!organizer||loadedRound!==round||!round)return;
    try{localStorage.setItem("pom-board-v2:"+round,JSON.stringify(board));setSaved(true);}
    catch{setSaved(false);setError(th?"บันทึกฉบับร่างในเครื่องไม่ได้":"Could not save local draft");}
  },[board,loadedRound,round,organizer]);
  function limitedTeam(team:string){return !!team&&team!=="STANDBY";}
  function teamMemberCount(team:string){return players.filter(p=>board[p.player_id]?.team===team).length;}
  function destinationIsFull(team:string,id:string,target?:string){
    return limitedTeam(team)&&!target&&board[id]?.team!==team&&teamMemberCount(team)>=5;
  }
  function move(id:string,team:string,target?:string){
    if(!organizer||cloudBusy||publishing||loading||!players.some(p=>p.player_id===id)||id===target)return;
    if(destinationIsFull(team,id,target)){
      setError(th?"ทีมนี้เต็มแล้ว (สูงสุด 5 คน) · วางทับผู้เล่นเพื่อสลับทีมได้":"This team is full (maximum 5). Drop on a player to swap teams.");
      return;
    }
    setBoard(previous=>{
      const next={...previous};const source=next[id];
      if(target&&next[target]){
        if(source)next[target]={...next[target],team:source.team};else delete next[target];
      }
      if(team) next[id]={...source,team,loadout:source?.loadout||players.find(p=>p.player_id===id)?.loadouts[0]?.id||""};
      else delete next[id];
      for(const playerId of Object.keys(next))if(next[playerId].team==="STANDBY"){
        next[playerId]={...next[playerId],jungle:undefined,tower:undefined};
      }
      return next;
    });
    setError("");setSelected("");setDraggingPlayer("");setDropTarget(null);
  }
  function drop(e:React.DragEvent,team:string,target?:string){
    e.preventDefault();e.stopPropagation();move(e.dataTransfer.getData("text/plain"),team,target);
  }

  function setTower(id:string,lane:string) {
    if(!organizer||cloudBusy||publishing||loading||!board[id]||board[id].team==="STANDBY")return;
    if(lane&&Object.entries(board).filter(([pid,p])=>pid!==id&&p.tower===lane).length>=3){
      setError(th?"Tower ตำแหน่งนี้ครบ 3 คนแล้ว":"This tower already has 3 players");return;
    }
    setBoard(b=>({...b,[id]:{...b[id],tower:lane||undefined}}));setError("");setSelected("");
  }
  function role(p:Player){return p.loadouts.find(l=>l.id===board[p.player_id]?.loadout)?.role||p.preferred_role||p.loadouts[0]?.role||"—";}
  function card(p:Player){
    const place=board[p.player_id];
    const isSwapTarget=dropTarget?.playerId===p.player_id;
    const selectedPlace=selected?board[selected]:undefined;
    const isClickSwap=!!selected&&selected!==p.player_id&&selectedPlace?.team!==place?.team;
    return <article key={p.player_id} className={"gw-player gw-role-"+role(p)+(selected===p.player_id?" gw-selected":"")+(draggingPlayer===p.player_id?" gw-dragging":"")+(isSwapTarget?" gw-swap-target":"")+(isClickSwap?" gw-swap-choice":"")}
      draggable={!!organizer&&!loading&&!cloudBusy&&!publishing}
      onDragStart={e=>{e.dataTransfer.setData("text/plain",p.player_id);e.dataTransfer.effectAllowed="move";setDraggingPlayer(p.player_id);setDropTarget(null);}}
      onDragEnd={()=>{setDraggingPlayer("");setDropTarget(null);}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();if(draggingPlayer&&draggingPlayer!==p.player_id)setDropTarget({team:place?.team||"",playerId:p.player_id});}}
      onDrop={e=>drop(e,place?.team||"",p.player_id)}>
      <button className="gw-pick" disabled={!organizer} onClick={()=>{
        if(isClickSwap){move(selected,place?.team||"",p.player_id);return;}
        setSelected(selected===p.player_id?"":p.player_id);
      }} title={isClickSwap?(th?"คลิกเพื่อสลับทีม":"Click to swap teams"):(th?"เลือกเพื่อย้ายทีม":"Select to move")}>
        <span>{p.character_name}</span>{p.nickname&&<small>({p.nickname})</small>}
      </button>
      {place&&<button className="gw-remove" disabled={!organizer} onClick={()=>move(p.player_id,"")} aria-label={th?"นำออกจากทีม":"Remove from team"}>×</button>}
      <div className="gw-meta">{p.attendance_status==="expected"?(th?"ขาประจำ":"Regular"):(th?"ยืนยัน":"Confirmed")}</div>
      <div className="gw-meta">{role(p)}</div>
      {place?<select aria-label={"Loadout "+p.character_name} value={place.loadout} disabled={!organizer} onChange={e=>setBoard(current=>({...current,[p.player_id]:{...current[p.player_id],loadout:e.target.value}}))}>
        {!p.loadouts.length&&<option value="">—</option>}{p.loadouts.map(l=><option key={l.id} value={l.id}>{l.role} · {l.main_weapon_name} + {l.sub_weapon_name}</option>)}
      </select>:<div className="gw-meta">{p.loadouts.map(l=>l.main_weapon_name+" + "+l.sub_weapon_name).join(" / ")}</div>}
      {place&&place.team!=="STANDBY"&&<select className={"gw-jungle-select "+(place.jungle?"gw-jungle-"+place.jungle.toLowerCase():"")} aria-label={"Jungle "+p.character_name} value={place.jungle||""} disabled={!organizer||loading}
        onChange={e=>setBoard(current=>({...current,[p.player_id]:{...current[p.player_id],jungle:e.target.value||undefined}}))}>
        <option value="">{th?"ไม่เข้าป่า":"No jungle"}</option>
        {jungles.map((j,i)=><option key={j} value={j}>{th?["ศัตรูบน","ศัตรูล่าง","เราบน","เราล่าง"][i]:title(j,th)}</option>)}
      </select>}
      {place&&place.team!=="STANDBY"&&<select className="gw-tower-select" aria-label={(th?"ป้อม ":"Tower ")+p.character_name} value={place.tower||""} disabled={!organizer||loading}
        onChange={e=>setTower(p.player_id,e.target.value)}>
        <option value="">{th?"ป้อม: ไม่เลือก":"Tower: none"}</option>
        {lanes.map(lane=><option key={lane} value={lane}>{th?"ป้อม: "+({TOP:"บน",MID:"กลาง",BOTTOM:"ล่าง"}[lane]||lane):"Tower: "+lane}</option>)}
      </select>}
    </article>;
  }
  function squad(team:string){
    const members=players.filter(p=>board[p.player_id]?.team===team);
    const tank=members.filter(p=>role(p)==="Tank").length,heal=members.filter(p=>role(p)==="Heal").length;
    const teamFull=limitedTeam(team)&&members.length>=5;
    const isTeamDropTarget=dropTarget?.team===team&&!dropTarget.playerId;
    const isSourceTeam=draggingPlayer&&board[draggingPlayer]?.team===team;
    return <section key={team} className={"gw-squad "+teamClass(team)+(team.startsWith("ATTACK")?" gw-attack":team==="FOREST"?" gw-forest":" gw-defense")+(isSourceTeam?" gw-drag-source":"")+(isTeamDropTarget?(teamFull?" gw-drop-blocked":" gw-drop-ready"):"")}
      onDragOver={e=>{e.preventDefault();if(draggingPlayer)setDropTarget({team});}} onDrop={e=>drop(e,team)}>
      <header><strong>{title(team,th)}</strong><span>{members.length}{team!=="STANDBY"?"/5":""}</span></header>
      {team!=="STANDBY"&&<div className="gw-meta">Tank {tank} · Heal {heal}{teamFull?" · "+(th?"เต็ม":"Full"):""}</div>}
      <div className="gw-slots">{members.map(card)}</div>
      <button className="gw-drop" disabled={!organizer||!selected||destinationIsFull(team,selected)} onClick={()=>move(selected,team)}>
        {selected?(teamFull?(th?"ทีมเต็ม · วางทับเพื่อสลับ":"Team full · Drop on a player to swap"):(th?"วางผู้เล่นที่เลือก":"Place selected player")):(th?"ลากผู้เล่นมาวาง":"Drop players here")}
      </button>
    </section>;
  }
  const pool=players.filter(p=>!board[p.player_id]);
  const warnings=teams.filter(t=>t!=="STANDBY").filter(t=>{
    const m=players.filter(p=>board[p.player_id]?.team===t);
    return m.length>0&&(m.length>5||!m.some(p=>role(p)==="Tank")||!m.some(p=>role(p)==="Heal"));
  }).length;

  const roundInfo=rounds.find(r=>r.id===round);
  const roundLabel=roundInfo?new Date(roundInfo.starts_at).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"})+" · "+roundInfo.war_type:round;
  // Keep copied names literal and prevent pasted names from creating Discord mentions.
  const literal=(value:string)=>value.replace(/@/g,"@\u200b").replace(/[\r\n]/g," ").replace(/([*_~\x60|>\\])/g,"\\$1");
  function playerSummary(p:Player,index:number){
    const placement=board[p.player_id];
    const loadout=p.loadouts.find(l=>l.id===placement?.loadout);
    return (index+1)+". "+literal(p.character_name)+" · "+role(p)+
      (loadout?" · "+literal(loadout.main_weapon_name)+" + "+literal(loadout.sub_weapon_name):"")+
      (placement?.jungle?" · Jungle: "+title(placement.jungle,th):"")+
      (placement?.tower?" · Tower: "+placement.tower:"");
  }
  const summaryLines=[
    (th?"ฉบับร่าง — ยังไม่ประกาศ":"DRAFT — NOT PUBLISHED")+" | "+roundLabel,
    ...[...teams,"UNASSIGNED"].flatMap(team=>{
      const members=players.filter(p=>team==="UNASSIGNED"?!board[p.player_id]:board[p.player_id]?.team===team);
      return ["",title(team,th)+" ("+members.length+")",...members.map(playerSummary)];
    })
  ];
  // Split at line boundaries, with a bounded fallback for unusually long player names.
  const copyParts:string[]=[];
  for(const line of summaryLines){
    for(let offset=0;offset<Math.max(1,line.length);offset+=1700){
      const piece=line.slice(offset,offset+1700);
      const last=copyParts.length-1;
      if(last<0||copyParts[last].length+piece.length+1>1800)copyParts.push(piece);
      else copyParts[last]+="\n"+piece;
    }
  }
  async function copyPart(index:number){
    try{await navigator.clipboard.writeText(copyParts[index]);setCopyMessage(th?"คัดลอกส่วนที่ "+(index+1)+" แล้ว":"Copied part "+(index+1));}
    catch{setCopyMessage(th?"คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างเพื่อคัดลอกเอง":"Clipboard unavailable. Select the text below to copy.");}
  }

  return <section className="gw-builder"><fieldset disabled={cloudBusy||publishing} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <header className="gw-top"><div><h1>Guild War Team Builder</h1><p>{th?"เลือก 2 คนเพื่อสลับ · ทีมละ 5 คน":"Select 2 players to swap · 5 per team"}</p></div>
      <div className="gw-toolbar"><select aria-label="War round" value={round} onChange={e=>setRound(e.target.value)}>{rounds.map(r=><option key={r.id} value={r.id}>{new Date(r.starts_at).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"})} · {r.war_type}</option>)}</select>
      <a className="gw-regular-link" href="/games/where-winds-meet/guild-war/regulars">{th?"ขาประจำ":"Regulars"}</a>
      <button disabled={!organizer||loading||loadedRound!==round} onClick={()=>cloudDraft("save")}>{th?"บันทึกออนไลน์":"Save online"}</button>
      <button disabled={!organizer||loading||loadedRound!==round} onClick={()=>cloudDraft("load")}>{th?"โหลดออนไลน์":"Load online"}</button>
      <button disabled={!organizer||loading||loadedRound!==round} onClick={()=>{setCopyMessage("");summaryDialog.current?.showModal();}}>Team Summary</button>
      <button onClick={()=>setRefresh(v=>v+1)}>Refresh</button><button disabled={!organizer||loading} onClick={()=>{if(window.confirm(th?"ล้างฉบับร่างรอบนี้?":"Clear this round's draft?"))setBoard({});}}>Reset board</button></div></header>
    <div className="gw-status">{organizer?organizer:<a href="/api/auth/discord/login?return=%2Fgames%2Fwhere-winds-meet%2Fguild-war%2Fteams">Discord Login</a>} · {saved?(th?"ฉบับร่างบันทึกในเครื่อง · ยังไม่ประกาศ":"Local draft saved · Not published"):(th?"ฉบับร่างในเครื่อง":"Local draft")}</div>
    <p role="status" aria-live="polite">{cloudBusy?(th?"กำลังติดต่อฉบับร่างออนไลน์…":"Updating online draft…"):cloudMessage}</p>
    {error&&<p role="alert" className="gw-error">{error}</p>}
    <div className="gw-stats">{[[players.length,"Registered"],[players.length-pool.length,"Assigned"],[pool.length,"Unassigned"],[warnings,"Squad warnings"]].map(([n,l])=><div key={l}><b>{n}</b><small>{l}</small></div>)}</div>
    {loading?<p role="status">{th?"กำลังโหลด…":"Loading…"}</p>:<div className="gw-layout"><aside className={"gw-pool "+(dropTarget?.team===""&&!dropTarget.playerId?" gw-drop-ready":"")} onDragOver={e=>{e.preventDefault();if(draggingPlayer)setDropTarget({team:""});}} onDrop={e=>drop(e,"")}>
      <header><strong>{th?"ยังไม่จัดทีม":"Unassigned"}</strong><input aria-label="Search players" placeholder={th?"ค้นหาชื่อ…":"Search players…"} value={search} onChange={e=>setSearch(e.target.value)}/></header>
      <div className="gw-pool-list">{pool.filter(p=>(p.character_name+" "+(p.nickname||"")).toLowerCase().includes(search.toLowerCase())).map(card)}</div>
      {selected&&<button onClick={()=>move(selected,"")}>{th?"นำกลับ Unassigned":"Return to Unassigned"}</button>}
    </aside><div className="gw-board"><div className="gw-sides"><section><h2>{th?"ฝั่งบุก":"Attack"}</h2><div className="gw-squads">{teams.slice(0,3).map(squad)}</div></section><section><h2>{th?"ฝั่งกัน":"Defense"}</h2><div className="gw-squads">{teams.slice(3,6).map(squad)}</div></section></div><div className="gw-standby">{squad("STANDBY")}</div></div></div>}
    {!loading&&<section className="gw-tactical"><h2>Tower Assignment</h2><p>{th?"ลากผู้เล่นจากทีมมาวาง หรือคลิกชื่อแล้วเลือก Tower · ตำแหน่งละไม่เกิน 3 คน":"Drag a team player here, or select a player then a tower · Maximum 3 per tower"}</p>
      <div className="gw-towers">{lanes.map(lane=><section key={lane} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();setTower(e.dataTransfer.getData("text/plain"),lane);}}>
        <header><strong>{title(lane,th)}</strong><span>{Object.values(board).filter(p=>p.tower===lane).length}/3</span></header>
        {players.filter(p=>board[p.player_id]?.tower===lane).map(p=><div className="gw-tower-player" key={p.player_id}><span>{p.character_name}</span><button disabled={!organizer} onClick={()=>setTower(p.player_id,"")} aria-label={"Remove tower "+p.character_name}>×</button></div>)}
        <button className="gw-drop" disabled={!organizer||!selected||!board[selected]||board[selected].team==="STANDBY"} onClick={()=>setTower(selected,lane)}>{th?"วางผู้เล่นที่เลือก":"Place selected player"}</button>
      </section>)}</div>
    </section>}
  </fieldset>
    <dialog ref={summaryDialog} className="gw-summary-dialog">
      <header><div><h2>{th?"สรุปทีม":"Team Summary"}</h2><p>{roundLabel}</p></div><button onClick={()=>summaryDialog.current?.close()} autoFocus>{th?"กลับไปจัดทีม":"Back to builder"}</button></header>
      <p className="gw-status">{th?"ฉบับร่าง · ยังไม่ประกาศ":"Draft · Not published"}</p>
      {(pool.length>0||warnings>0)&&<p className="gw-error">{pool.length} {th?"ยังไม่จัด · เตือนทีม":"Unassigned · warnings"} {warnings}</p>}
      <div className="gw-summary-grid">{[...teams,"UNASSIGNED"].map(team=><section key={team} className={"gw-summary-team "+teamClass(team)}>
        <header><h3>{title(team,th)}</h3><span>{players.filter(p=>team==="UNASSIGNED"?!board[p.player_id]:board[p.player_id]?.team===team).length}{team!=="STANDBY"&&team!=="UNASSIGNED"?"/5":""}</span></header>
        {players.filter(p=>team==="UNASSIGNED"?!board[p.player_id]:board[p.player_id]?.team===team).map((p,i)=><p key={p.player_id}>{playerSummary(p,i)}</p>)}
      </section>)}</div>
      <div>
        <button disabled={publishing||cloudBusy||loading||!organizer||revision<1||savedBoard!==JSON.stringify(board)||Object.keys(board).length===0||warnings>0&&teams.some(t=>t!=="STANDBY"&&Object.values(board).filter(p=>p.team===t).length>5)} onClick={publishTeam}>
          {publishing?(th?"กำลังประกาศ…":"Publishing…"):(th?"ประกาศทีมและสร้างลิงก์":"Publish teams and create link")}
        </button>
        {savedBoard!==JSON.stringify(board)&&<p>{th?"กลับไปบันทึกออนไลน์ก่อนประกาศทีมฉบับนี้":"Save this board online before publishing."}</p>}
        {publishedLink&&<p role="status">{th?"ประกาศแล้ว: ":"Published: "}<a href={publishedLink} target="_blank" rel="noreferrer">{th?"เปิดทีมที่ประกาศ":"Open published teams"}</a><input readOnly aria-label={th?"ลิงก์ประกาศทีม":"Published team link"} value={publishedLink} onFocus={e=>e.target.select()}/></p>}
        {error&&<p role="alert">{error}</p>}
      </div>
      <h3>{th?"ข้อความสำหรับ Discord":"Discord text"}</h3>
      <p>{th?"คัดลอกทีละส่วนแล้วนำไปวางใน Discord ได้":"Copy each part and paste it into Discord."}</p>
      <p role="status" aria-live="polite">{copyMessage}</p>
      {copyParts.map((part,i)=><div key={i} className="gw-copy-part"><button onClick={()=>copyPart(i)}>{th?"คัดลอกส่วนที่ ":"Copy part "}{i+1}/{copyParts.length}</button><textarea readOnly aria-label={"Discord text "+(i+1)} value={part} onFocus={e=>e.target.select()}/></div>)}
    </dialog>
  </section>;
}
