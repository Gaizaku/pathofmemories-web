import {useEffect, useState} from "react";
type Player = {player_id:string; character_name:string; preferred_role?:string; loadouts:{id:string;role:string;main_weapon_name:string;sub_weapon_name:string}[]};
type Round = {id:string;starts_at:string;war_type:string};
type Placement = {team:string; loadout:string; jungle?:string; tower?:string};
const jungles = ["ENEMY_TOP","ENEMY_BOTTOM","ALLY_TOP","ALLY_BOTTOM"];
const lanes = ["TOP","MID","BOTTOM"];
const teams = ["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const title = (s:string) => s.replaceAll("_"," ");
const base = "/api/v2/games/where-winds-meet";
export function GuildWarTeamBuilder({language}:{language:"th"|"en"}) {
  const th = language === "th";
  const [rounds,setRounds] = useState<Round[]>([]);
  const [round,setRound] = useState("");
  const [players,setPlayers] = useState<Player[]>([]);
  const [board,setBoard] = useState<Record<string,Placement>>({});
  const [organizer,setOrganizer] = useState<string>("");
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [loadedRound,setLoadedRound] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [saved,setSaved] = useState(false);
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
    const c=new AbortController();setLoading(true);setError("");setLoadedRound("");setSelected("");
    get(base+"/war/events/"+round+"/registrations",c.signal).then(d=>{
      const roster:Player[]=d.registrations||[];const valid:Record<string,Placement>={};
      try {
        const old=JSON.parse(localStorage.getItem("pom-board-v2:"+round)||"{}");
        for(const p of roster) if(old[p.player_id]&&teams.includes(old[p.player_id].team))
          valid[p.player_id]={team:old[p.player_id].team,loadout:p.loadouts.some(l=>l.id===old[p.player_id].loadout)?old[p.player_id].loadout:p.loadouts[0]?.id||""};
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
  function move(id:string,team:string,target?:string){
    if(!organizer||loading||!players.some(p=>p.player_id===id)||id===target)return;
    setBoard(previous=>{
      const next={...previous};const source=next[id];
      if(target&&next[target]){
        if(source)next[target]={...next[target],team:source.team};else delete next[target];
      }
      if(team) next[id]={...source,team,loadout:source?.loadout||players.find(p=>p.player_id===id)?.loadouts[0]?.id||""};
      else delete next[id];
      for(const id of Object.keys(next))if(next[id].team==="STANDBY"){next[id]={...next[id],jungle:undefined,tower:undefined};}
      return next;
    });setSelected("");
  }
  function drop(e:React.DragEvent,team:string,target?:string){
    e.preventDefault();e.stopPropagation();move(e.dataTransfer.getData("text/plain"),team,target);
  }

  function setTower(id:string,lane:string) {
    if(!organizer||loading||!board[id]||board[id].team==="STANDBY")return;
    if(lane&&Object.entries(board).filter(([pid,p])=>pid!==id&&p.tower===lane).length>=3){
      setError(th?"Tower ตำแหน่งนี้ครบ 3 คนแล้ว":"This tower already has 3 players");return;
    }
    setBoard(b=>({...b,[id]:{...b[id],tower:lane||undefined}}));setError("");setSelected("");
  }
  function role(p:Player){return p.loadouts.find(l=>l.id===board[p.player_id]?.loadout)?.role||p.preferred_role||p.loadouts[0]?.role||"—";}
  function card(p:Player){
    const place=board[p.player_id];
    return <article key={p.player_id} className={"gw-player gw-role-"+role(p)+(selected===p.player_id?" gw-selected":"")}
      draggable={!!organizer&&!loading} onDragStart={e=>{e.dataTransfer.setData("text/plain",p.player_id);e.dataTransfer.effectAllowed="move";}}
      onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,place?.team||"",p.player_id)}>
      <button className="gw-pick" disabled={!organizer} onClick={()=>setSelected(selected===p.player_id?"":p.player_id)} title={th?"เลือกเพื่อย้ายทีม":"Select to move"}>{p.character_name}</button>
      {place&&<button className="gw-remove" disabled={!organizer} onClick={()=>move(p.player_id,"")} aria-label={th?"นำออกจากทีม":"Remove from team"}>×</button>}
      <div className="gw-meta">{role(p)}{p.preferred_role?" · Pref "+p.preferred_role:""}</div>
      {place?<select aria-label={"Loadout "+p.character_name} value={place.loadout} disabled={!organizer} onChange={e=>setBoard(b=>({...b,[p.player_id]:{...b[p.player_id],loadout:e.target.value}}))}>
        {!p.loadouts.length&&<option value="">—</option>}{p.loadouts.map(l=><option key={l.id} value={l.id}>{l.role} · {l.main_weapon_name} + {l.sub_weapon_name}</option>)}
      </select>:<div className="gw-meta">{p.loadouts.map(l=>l.main_weapon_name+" + "+l.sub_weapon_name).join(" / ")}</div>}
      {place&&place.team!=="STANDBY"&&<select aria-label={"Jungle "+p.character_name} value={place.jungle||""} disabled={!organizer||loading}
        onChange={e=>setBoard(b=>({...b,[p.player_id]:{...b[p.player_id],jungle:e.target.value||undefined}}))}>
        <option value="">{th?"ไม่เข้าป่า":"No jungle"}</option>
        {jungles.map((j,i)=><option key={j} value={j}>{th?["ป่าบนศัตรู","ป่าล่างศัตรู","ป่าบนฝั่งเรา","ป่าล่างฝั่งเรา"][i]:title(j)}</option>)}
      </select>}
    </article>;
  }
  function squad(team:string){
    const members=players.filter(p=>board[p.player_id]?.team===team);
    const tank=members.filter(p=>role(p)==="Tank").length,heal=members.filter(p=>role(p)==="Heal").length;
    return <section key={team} className={"gw-squad "+(team.startsWith("ATTACK")?"gw-attack":team==="FOREST"?"gw-forest":"gw-defense")}
      onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,team)}>
      <header><strong>{title(team)}</strong><span>{members.length}{team!=="STANDBY"?"/5":""}</span></header>
      {team!=="STANDBY"&&<div className="gw-meta">Tank {tank}/1 · Heal {heal}/1{members.length>5?" · ⚠ >5":""}</div>}
      <div className="gw-slots">{members.map(card)}</div>
      <button className="gw-drop" disabled={!organizer||!selected} onClick={()=>move(selected,team)}>{selected?(th?"วางผู้เล่นที่เลือก":"Place selected player"):(th?"ลากผู้เล่นมาวาง":"Drop players here")}</button>
    </section>;
  }
  const pool=players.filter(p=>!board[p.player_id]);
  const warnings=teams.filter(t=>t!=="STANDBY").filter(t=>{
    const m=players.filter(p=>board[p.player_id]?.team===t);
    return m.length>0&&(m.length>5||!m.some(p=>role(p)==="Tank")||!m.some(p=>role(p)==="Heal"));
  }).length;
  return <section className="gw-builder">
    <header className="gw-top"><div><h1>Guild War Team Builder</h1><p>{th?"ลากวาง · วางทับเพื่อสลับตำแหน่ง · คลิกชื่อแล้วเลือกทีมได้":"Drag & drop · Drop on a player to swap · Or select a player then a team"}</p></div>
      <div className="gw-toolbar"><select aria-label="War round" value={round} onChange={e=>setRound(e.target.value)}>{rounds.map(r=><option key={r.id} value={r.id}>{new Date(r.starts_at).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"})} · {r.war_type}</option>)}</select>
      <button onClick={()=>setRefresh(v=>v+1)}>Refresh</button><button disabled={!organizer||loading} onClick={()=>{if(window.confirm(th?"ล้างฉบับร่างรอบนี้?":"Clear this round's draft?"))setBoard({});}}>Reset board</button></div></header>
    <div className="gw-status">{organizer?organizer:<a href="/api/auth/discord/login?return=%2Fgames%2Fwhere-winds-meet%2Fguild-war%2Fteams">Discord Login</a>} · {saved?(th?"ฉบับร่างบันทึกในเครื่อง · ยังไม่ประกาศ":"Local draft saved · Not published"):(th?"ฉบับร่างในเครื่อง":"Local draft")}</div>
    {error&&<p role="alert" className="gw-error">{error}</p>}
    <div className="gw-stats">{[[players.length,"Registered"],[players.length-pool.length,"Assigned"],[pool.length,"Unassigned"],[warnings,"Squad warnings"]].map(([n,l])=><div key={l}><b>{n}</b><small>{l}</small></div>)}</div>
    {loading?<p role="status">{th?"กำลังโหลด…":"Loading…"}</p>:<div className="gw-layout"><aside className="gw-pool" onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,"")}>
      <header><strong>Unassigned</strong><input aria-label="Search players" placeholder={th?"ค้นหาชื่อ…":"Search players…"} value={search} onChange={e=>setSearch(e.target.value)}/></header>
      <div className="gw-pool-list">{pool.filter(p=>p.character_name.toLowerCase().includes(search.toLowerCase())).map(card)}</div>
      {selected&&<button onClick={()=>move(selected,"")}>{th?"นำกลับ Unassigned":"Return to Unassigned"}</button>}
    </aside><div className="gw-board"><div className="gw-sides"><section><h2>{th?"ฝั่งบุก":"Attack"}</h2><div className="gw-squads">{teams.slice(0,3).map(squad)}</div></section><section><h2>{th?"ฝั่งกัน":"Defense"}</h2><div className="gw-squads">{teams.slice(3,6).map(squad)}</div></section></div><div className="gw-standby">{squad("STANDBY")}</div></div></div>}
    {!loading&&<section className="gw-tactical"><h2>Tower Assignment</h2><p>{th?"ลากผู้เล่นจากทีมมาวาง หรือคลิกชื่อแล้วเลือก Tower · ตำแหน่งละไม่เกิน 3 คน":"Drag a team player here, or select a player then a tower · Maximum 3 per tower"}</p>
      <div className="gw-towers">{lanes.map(lane=><section key={lane} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();setTower(e.dataTransfer.getData("text/plain"),lane);}}>
        <header><strong>{title(lane)}</strong><span>{Object.values(board).filter(p=>p.tower===lane).length}/3</span></header>
        {players.filter(p=>board[p.player_id]?.tower===lane).map(p=><div className="gw-tower-player" key={p.player_id}><span>{p.character_name}</span><button disabled={!organizer} onClick={()=>setTower(p.player_id,"")} aria-label={"Remove tower "+p.character_name}>×</button></div>)}
        <button className="gw-drop" disabled={!organizer||!selected||!board[selected]||board[selected].team==="STANDBY"} onClick={()=>setTower(selected,lane)}>{th?"วางผู้เล่นที่เลือก":"Place selected player"}</button>
      </section>)}</div>
    </section>}
  </section>;
}
