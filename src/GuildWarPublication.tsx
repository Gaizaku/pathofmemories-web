import {useEffect,useState} from "react";
import "./GuildWarPublication.css";
type Publication={publishedAt:string;event:{startsAt:string;warType:string};unassignedCount:number;members:{name:string;team:string;role:string;mainWeapon:string;subWeapon:string;jungle:string;tower:string}[]};
const teams=["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST","STANDBY"];
const teamNames:Record<string,[string,string]>={ATTACK_1:['ทีมบุก 1','Attack 1'],ATTACK_2:['ทีมบุก 2','Attack 2'],ATTACK_3:['ทีมบุก 3','Attack 3'],DEFENSE_1:['ทีมป้องกัน 1','Defense 1'],DEFENSE_2:['ทีมป้องกัน 2','Defense 2'],FOREST:['ป่า','Forest'],STANDBY:['สำรอง','Standby']};
const teamClass=(team:string)=>'gw-team-'+team.toLowerCase();
export function GuildWarPublication({language,eventId,publicationId}:{language:"th"|"en";eventId:string;publicationId:string}){
 const th=language==="th";
 const [data,setData]=useState<Publication|null>(null),[error,setError]=useState(""),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  setData(null);setError("");
  fetch("/api/v2/games/where-winds-meet/war/events/"+encodeURIComponent(eventId)+"/publications/"+encodeURIComponent(publicationId),{signal:controller.signal})
   .then(async r=>{if(!r.ok)throw new Error(r.status===404?"missing":"unavailable");return r.json();})
   .then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return ()=>controller.abort();
 },[eventId,publicationId]);
 const date=(value:string)=>new Date(value).toLocaleString(th?"th-TH":"en-GB",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"});
 return <section className="gw-publication">
  <a href="/games/where-winds-meet/guild-war/">{th?"← กลับ Guild War":"← Back to Guild War"}</a>
  <h1>{th?"ทีมที่ประกาศแล้ว":"Published teams"}</h1>
  {error?<p role="alert">{error==="missing"?(th?"ไม่พบฉบับประกาศนี้ กรุณาตรวจลิงก์":"Publication not found. Check the link."):(th?"โหลดไม่สำเร็จ กรุณารีเฟรชเพื่อลองใหม่":"Unable to load. Refresh to retry.")}</p>:!data?<p role="status">{th?"กำลังโหลดทีม…":"Loading teams…"}</p>:<>
   <p>{date(data.event.startsAt)} · {data.event.warType} · {th?"เวลาไทย":"Bangkok time"}</p>
   <p>{th?"ประกาศเมื่อ ":"Published "}{date(data.publishedAt)}</p>
   <p>{th?"ลิงก์นี้เป็นทีมฉบับที่ประกาศไว้ หากผู้จัดประกาศใหม่จะมีลิงก์ใหม่":"This link preserves this published edition. A new edition has a new link."}</p>
   <button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}catch{setCopyError(true);}}}>{copied?(th?"คัดลอกแล้ว":"Copied"):(th?"คัดลอกลิงก์":"Copy link")}</button>
   {copyError&&<p role="status">{th?"คัดลอกไม่ได้ กรุณาคัดลอก URL จากแถบที่อยู่":"Copy the URL from your address bar."}</p>}
   <div className="gw-publication-grid">{teams.map(team=><section key={team} className={teamClass(team)}>
    <h2>{teamNames[team][th?0:1]} <small>({data.members.filter(m=>m.team===team).length})</small></h2>
    <ol>{data.members.filter(m=>m.team===team).map((m,i)=><li key={i}><strong>{m.name}</strong><span>{m.role}{m.mainWeapon?" · "+m.mainWeapon+" + "+m.subWeapon:""}</span>{m.jungle&&<span>Jungle · {m.jungle.replaceAll("_"," ")}</span>}{m.tower&&<span>Tower · {m.tower}</span>}</li>)}</ol>
   </section>)}</div>
   {data.unassignedCount>0&&<p>{th?"ผู้ลงทะเบียนที่ยังไม่ได้จัดทีม ณ เวลาประกาศ: ":"Unassigned at publication: "}{data.unassignedCount}</p>}
  </>}
 </section>;
}
