import {useEffect,useState} from "react";
import "./GuildWarPublication.css";

type Member={name:string;team:string;role:string;mainWeapon:string;subWeapon:string;jungle:string;tower:string;towerPosition?:number};
type Publication={publishedAt:string;event:{startsAt:string;warType:string};unassignedCount:number;members:Member[]};
const teams=["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const teamNames:Record<string,[string,string]>={ATTACK_1:["ทีมบุก 1","Attack 1"],ATTACK_2:["ทีมบุก 2","Attack 2"],ATTACK_3:["ทีมบุก 3","Attack 3"],DEFENSE_1:["ทีมกัน 1","Defense 1"],DEFENSE_2:["ทีมกัน 2","Defense 2"],FOREST:["ป่า","Forest"],STANDBY:["สำรอง","Standby"]};
const teamClass=(team:string)=>"gw-team-"+team.toLowerCase();
const laneNames:Record<string,[string,string]>={TOP:["ป้อมบน","Top tower"],MID:["ป้อมกลาง","Middle tower"],BOTTOM:["ป้อมล่าง","Bottom tower"]};
const jungleNames:Record<string,[string,string]>={ENEMY_TOP:["ศัตรูบน","Enemy top"],ENEMY_BOTTOM:["ศัตรูล่าง","Enemy bottom"],ALLY_TOP:["เราบน","Ally top"],ALLY_BOTTOM:["เราล่าง","Ally bottom"]};

export function GuildWarPublication({language,eventId,publicationId}:{language:"th"|"en";eventId:string;publicationId:string}){
 const th=language==="th";
 const [data,setData]=useState<Publication|null>(null),[error,setError]=useState(""),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  setData(null);setError("");
  fetch("/api/v2/games/where-winds-meet/war/events/"+encodeURIComponent(eventId)+"/publications/"+encodeURIComponent(publicationId),{signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error(response.status===404?"missing":"unavailable");return response.json();})
   .then(setData).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});
  return ()=>controller.abort();
 },[eventId,publicationId]);
 const date=(value:string)=>new Date(value).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"});
 const text=(labels:[string,string])=>labels[th?0:1];
 const members=(team:string)=>data?.members.filter(member=>member.team===team)||[];
 const towerMembers=(lane:string)=>data?.members.filter(member=>member.tower===lane).sort((a,b)=>(a.towerPosition??Number.MAX_SAFE_INTEGER)-(b.towerPosition??Number.MAX_SAFE_INTEGER))||[];
 return <section className="gw-publication gw-publication-summary">
  <a href="/games/where-winds-meet/guild-war/">{th?"← กลับ Guild War":"← Back to Guild War"}</a>
  {error?<p role="alert">{error==="missing"?(th?"ไม่พบฉบับประกาศนี้ กรุณาตรวจลิงก์":"Publication not found. Check the link."):(th?"โหลดไม่สำเร็จ กรุณาลองใหม่":"Unable to load. Please retry.")}</p>:!data?<p role="status">{th?"กำลังโหลดทีม…":"Loading teams…"}</p>:<>
   <header className="gw-publication-header"><div><h1>{th?"สรุปทีม":"Team Summary"}</h1><p>{date(data.event.startsAt)} · {data.event.warType}</p><small>{th?"ประกาศแล้ว":"Published"} · {date(data.publishedAt)}</small></div><button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}catch{setCopyError(true);}}}>{copied?(th?"คัดลอกแล้ว":"Copied"):(th?"คัดลอกลิงก์":"Copy link")}</button></header>
   {copyError&&<p role="status" className="gw-summary-notice">{th?"คัดลอกไม่ได้ กรุณาคัดลอก URL จากแถบที่อยู่":"Copy the URL from your address bar."}</p>}
   <div className="gw-summary-grid">{teams.filter(team=>team!=="STANDBY").map(team=>{const teamMembers=members(team);return <section key={team} className={"gw-summary-team "+teamClass(team)}><header><h3>{text(teamNames[team])}</h3><span>{teamMembers.length}/5</span></header><div className="gw-summary-members">{teamMembers.map((member,index)=><div className="gw-summary-player" key={team+index}><span className="gw-summary-number">{index+1}</span><span className="gw-summary-name"><b>{member.name}</b></span><strong className={"gw-summary-role gw-role-"+member.role}>{member.role||"—"}</strong><span className="gw-summary-weapons">{member.mainWeapon?member.mainWeapon+" + "+member.subWeapon:"—"}</span>{member.jungle&&<span className={"gw-summary-jungle gw-jungle-"+member.jungle.toLowerCase()}>{text(jungleNames[member.jungle]||[member.jungle,member.jungle])}</span>}</div>)}</div></section>;})}</div>
   <section className="gw-summary-towers"><header><h3>TOWER</h3><p>{th?"คนแรกของแต่ละป้อมคือ กลางป้อม":"The first player in each tower is the tower center"}</p></header><div>{Object.keys(laneNames).map(lane=>{const assigned=towerMembers(lane);return <section key={lane}><h4>{text(laneNames[lane])}</h4>{assigned.length?assigned.map((member,index)=><p key={member.name+index}><b>{member.name}</b>{index===0&&<span className="gw-tower-center">{th?"กลางป้อม":"Tower center"}</span>}</p>):<p className="gw-summary-empty">—</p>}</section>;})}</div></section>
   <section className="gw-summary-standby gw-team-standby"><header><h3>{text(teamNames.STANDBY)}</h3><span>{members("STANDBY").length}</span></header><div>{members("STANDBY").map((member,index)=><p key={member.name+index}>{member.name}</p>)}</div></section>
  </>}
 </section>;
}
